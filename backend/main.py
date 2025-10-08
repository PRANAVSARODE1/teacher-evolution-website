from fastapi import FastAPI, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import os
import asyncio
import jwt
import motor.motor_asyncio
from bson import ObjectId
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .config import settings


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)


# ====== Schemas ======
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str = Field(pattern="^(admin|evaluator|teacher)$")
    password: Optional[str] = None  # optional for passwordless


class UserLogin(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    otp: Optional[str] = None


class AssessmentCreate(BaseModel):
    teacher_name: str
    teacher_email: Optional[EmailStr] = None
    institution: str
    subject: str
    duration: int = 15
    criteria: Dict[str, bool] = {}


class Assessment(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ====== App ======
app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# ====== DB ======
mongo_client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URI)
db = mongo_client[settings.MONGO_DB_NAME]


# ====== Utils ======
def create_tokens(user: Dict[str, Any]) -> TokenResponse:
    now = datetime.utcnow()
    access_payload = {"sub": str(user["_id"]), "role": user["role"], "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)}
    refresh_payload = {"sub": str(user["_id"]), "type": "refresh", "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)}
    access = jwt.encode(access_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    refresh = jwt.encode(refresh_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return TokenResponse(access_token=access, refresh_token=refresh)


async def get_current_user(authorization: Optional[str] = None) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_roles(*roles):
    async def _inner(user: Dict[str, Any] = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user
    return _inner


# ====== Simple Rate Limiter and Audit Middleware ======
RATE_BUCKET: Dict[str, List[float]] = {}


@app.middleware("http")
async def rate_limit_and_audit(request: Request, call_next):
    # Rate limit per IP
    ip = request.client.host if request.client else "unknown"
    now = datetime.utcnow().timestamp()
    bucket = RATE_BUCKET.setdefault(ip, [])
    # purge old entries (>60s)
    RATE_BUCKET[ip] = [t for t in bucket if now - t < 60]
    if len(RATE_BUCKET[ip]) >= settings.RATE_LIMIT_PER_MINUTE:
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
    RATE_BUCKET[ip].append(now)

    # Proceed
    response = await call_next(request)

    # Audit log (best-effort)
    try:
        auth = request.headers.get("authorization", "")
        user_id = None
        if auth.lower().startswith("bearer "):
            try:
                payload = jwt.decode(auth.split(" ", 1)[1], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
                user_id = payload.get("sub")
            except Exception:
                pass
        await db.audit_logs.insert_one({
            "ts": datetime.utcnow(),
            "ip": ip,
            "path": request.url.path,
            "method": request.method,
            "status": response.status_code,
            "user_id": user_id,
        })
    except Exception:
        pass

    return response


# ====== Startup ======
@app.on_event("startup")
async def ensure_indexes():
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await db.users.create_index("email", unique=True)
    await db.assessments.create_index([("created_at", 1)])
    await db.audit_logs.create_index([("ts", -1)])
    await db.goals.create_index([("teacher_email", 1)])
    await db.followups.create_index([("teacher_email", 1)])
    await db.criteria.create_index([("org", 1)], unique=True)
    await db.transcripts.create_index([("assessment_id", 1)])


# ====== Auth Routes ======
@app.post("/api/auth/register", response_model=Dict[str, str])
async def register(user: UserCreate):
    doc = user.model_dump()
    # Simple password hash placeholder; replace with passlib/bcrypt
    if doc.get("password"):
        doc["password_hash"] = doc.pop("password")
    res = await db.users.insert_one(doc)
    return {"id": str(res.inserted_id)}


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    # Passwordless via OTP is out of scope for scaffold; accept if no password set
    if user.get("password_hash") and payload.password != user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return create_tokens(user)


@app.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid refresh token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return create_tokens(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")


# ====== Assessment Routes ======
@app.post("/api/assessments", dependencies=[Depends(require_roles("admin", "evaluator"))])
async def create_assessment(assessment: AssessmentCreate, user: Dict[str, Any] = Depends(get_current_user)):
    doc = assessment.model_dump()
    doc.update({"status": "pending", "created_by": str(user["_id"]), "created_at": datetime.utcnow()})
    res = await db.assessments.insert_one(doc)
    return {"success": True, "assessment_id": str(res.inserted_id)}


@app.post("/api/assessments/{assessment_id}/start", dependencies=[Depends(require_roles("admin", "evaluator"))])
async def start_assessment(assessment_id: str):
    await db.assessments.update_one({"_id": ObjectId(assessment_id)}, {"$set": {"status": "in-progress", "started_at": datetime.utcnow()}})
    return {"success": True}


@app.post("/api/assessments/{assessment_id}/complete", dependencies=[Depends(require_roles("admin", "evaluator"))])
async def complete_assessment(assessment_id: str):
    await db.assessments.update_one({"_id": ObjectId(assessment_id)}, {"$set": {"status": "completed", "completed_at": datetime.utcnow()}})
    # Simulate background job: finalize report, webhook, etc.
    asyncio.create_task(_background_finalize_report(assessment_id))
    return {"success": True}


@app.post("/api/assessments/{assessment_id}/data", dependencies=[Depends(require_roles("admin", "evaluator", "teacher"))])
async def push_assessment_data(assessment_id: str, payload: Dict[str, Any]):
    payload.update({
        "assessment_id": assessment_id,
        "ts": datetime.utcnow(),
    })
    await db.assessment_data.insert_one(payload)
    return {"success": True}


# ====== Uploads ======
@app.post("/api/uploads/video/{assessment_id}", dependencies=[Depends(require_roles("admin", "evaluator", "teacher"))])
async def upload_video(assessment_id: str, file: UploadFile = File(...), user: Dict[str, Any] = Depends(get_current_user)):
    filename = f"{assessment_id}_{int(datetime.utcnow().timestamp())}_{file.filename}"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        content = await file.read()
        f.write(content)
    await db.uploads.insert_one({
        "assessment_id": assessment_id,
        "filename": filename,
        "path": path,
        "size": len(content),
        "uploaded_by": str(user["_id"]),
        "created_at": datetime.utcnow(),
    })
    return {"success": True, "filename": filename}


# ====== WebSocket Rooms (basic) ======
rooms: Dict[str, List[WebSocket]] = {}


@app.websocket("/ws/rooms/{assessment_id}")
async def ws_room(ws: WebSocket, assessment_id: str):
    await ws.accept()
    rooms.setdefault(assessment_id, []).append(ws)
    try:
        while True:
            msg = await ws.receive_text()
            # broadcast to room
            for client in list(rooms.get(assessment_id, [])):
                if client is not ws:
                    await client.send_text(msg)
    except WebSocketDisconnect:
        rooms[assessment_id].remove(ws)
        if not rooms[assessment_id]:
            rooms.pop(assessment_id, None)


# ====== Feedback loop ======
class GoalCreate(BaseModel):
    teacher_email: EmailStr
    title: str
    description: Optional[str] = None


@app.post("/api/feedback/goals", dependencies=[Depends(require_roles("admin", "evaluator"))])
async def create_goal(goal: GoalCreate, user: Dict[str, Any] = Depends(get_current_user)):
    doc = goal.model_dump()
    doc.update({"created_at": datetime.utcnow(), "created_by": str(user["_id"]), "acknowledged": False})
    res = await db.goals.insert_one(doc)
    return {"success": True, "goal_id": str(res.inserted_id)}


@app.post("/api/feedback/goals/{goal_id}/acknowledge", dependencies=[Depends(require_roles("teacher"))])
async def acknowledge_goal(goal_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    await db.goals.update_one({"_id": ObjectId(goal_id)}, {"$set": {"acknowledged": True, "ack_at": datetime.utcnow(), "ack_by": str(user["_id"])}})
    return {"success": True}


class FollowUpCreate(BaseModel):
    teacher_email: EmailStr
    due_at: datetime
    note: Optional[str] = None


@app.post("/api/feedback/followups", dependencies=[Depends(require_roles("admin", "evaluator"))])
async def create_followup(f: FollowUpCreate, user: Dict[str, Any] = Depends(get_current_user)):
    doc = f.model_dump()
    doc.update({"created_at": datetime.utcnow(), "created_by": str(user["_id"])})
    res = await db.followups.insert_one(doc)
    return {"success": True, "followup_id": str(res.inserted_id)}


@app.get("/api/feedback/teacher/{teacher_email}")
async def list_feedback(teacher_email: str):
    goals = [
        {**g, "_id": str(g["_id"]) } async for g in db.goals.find({"teacher_email": teacher_email}).sort("created_at", -1)
    ]
    followups = [
        {**fu, "_id": str(fu["_id"]) } async for fu in db.followups.find({"teacher_email": teacher_email}).sort("created_at", -1)
    ]
    return {"goals": goals, "followups": followups}


# ====== Config management (criteria weights) ======
class CriteriaConfig(BaseModel):
    org: str
    weights: Dict[str, float]
    version: int = 1


@app.post("/api/config/criteria", dependencies=[Depends(require_roles("admin"))])
async def set_criteria(cfg: CriteriaConfig):
    await db.criteria.update_one({"org": cfg.org}, {"$set": cfg.model_dump()}, upsert=True)
    return {"success": True}


@app.get("/api/config/criteria/{org}")
async def get_criteria(org: str):
    doc = await db.criteria.find_one({"org": org})
    if not doc:
        raise HTTPException(status_code=404, detail="No config")
    doc["_id"] = str(doc["_id"])  # jsonify
    return doc


# ====== Transcript ingestion ======
class TranscriptChunk(BaseModel):
    text: str


KEYWORDS = ["example", "homework", "exam", "project", "definition"]


@app.post("/api/transcripts/{assessment_id}/append", dependencies=[Depends(require_roles("admin", "evaluator", "teacher"))])
async def append_transcript(assessment_id: str, chunk: TranscriptChunk):
    text = chunk.text
    hits = [k for k in KEYWORDS if k.lower() in text.lower()]
    await db.transcripts.insert_one({
        "assessment_id": assessment_id,
        "text": text,
        "keywords": hits,
        "ts": datetime.utcnow(),
    })
    return {"success": True, "keywords": hits}


# ====== PDF Export ======
@app.post("/api/reports/{assessment_id}/pdf")
async def export_pdf(assessment_id: str):
    assess = await db.assessments.find_one({"_id": ObjectId(assessment_id)})
    if not assess:
        raise HTTPException(status_code=404, detail="Assessment not found")

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, "Teacher Assessment Report")
    c.setFont("Helvetica", 11)
    y = height - 90
    def line(txt: str):
        nonlocal y
        c.drawString(50, y, txt)
        y -= 18

    line(f"Assessment ID: {assessment_id}")
    line(f"Teacher: {assess.get('teacher_name', '-')}")
    line(f"Institution: {assess.get('institution', '-')}")
    line(f"Subject: {assess.get('subject', '-')}")
    line(f"Status: {assess.get('status', '-')}")
    line(f"Created at: {assess.get('created_at', '-')}")

    # Simple metrics from latest data
    latest = await db.assessment_data.find_one({"assessment_id": assessment_id}, sort=[("ts", -1)])
    if latest:
        line("-")
        line("Latest Metrics:")
        for k, v in latest.items():
            if k in ("_id", "assessment_id", "ts"):
                continue
            line(f"  {k}: {v}")

    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=assessment_{assessment_id}.pdf"
    })


# ====== Background tasks ======
async def _background_finalize_report(assessment_id: str):
    # Aggregate data and mark result; placeholder for jobs/webhooks
    await db.assessments.update_one({"_id": ObjectId(assessment_id)}, {"$set": {"finalized_at": datetime.utcnow()}})


# ====== Health ======
@app.get("/health")
async def health():
    # Ensure Mongo connection
    await db.command("ping")
    return {"status": "ok"}


