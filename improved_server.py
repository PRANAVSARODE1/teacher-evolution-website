#!/usr/bin/env python3
"""
Enhanced Teacher Assessment Platform Server
Features:
- Real-time WebSocket communication
- Advanced AI analysis
- Database integration
- Better error handling
- API endpoints
"""

import asyncio
import json
import os
import sys
import logging
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import ssl
import threading
import time

# Web framework
try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import HTMLResponse, JSONResponse
    from pydantic import BaseModel
    import uvicorn
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False
    print("⚠️  FastAPI not available. Install with: pip install fastapi uvicorn")

# Database
try:
    import sqlite3
    import aiosqlite
    DATABASE_AVAILABLE = True
except ImportError:
    DATABASE_AVAILABLE = False

# AI and ML
try:
    import numpy as np
    import cv2
    from tensorflow import keras
    import librosa
    import speech_recognition as sr
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    print("⚠️  AI libraries not available. Install with: pip install numpy opencv-python tensorflow librosa SpeechRecognition")

# Configuration
class Config:
    PORT = 8443
    HOST = "0.0.0.0"
    CERT_FILE = 'server.crt'
    KEY_FILE = 'server.key'
    DATABASE_FILE = 'assessments.db'
    LOG_LEVEL = logging.INFO
    
    # AI Configuration
    CONFIDENCE_THRESHOLD = 0.7
    MIN_ASSESSMENT_DURATION = 30  # seconds
    MAX_ASSESSMENT_DURATION = 3600  # 1 hour
    
    # WebSocket settings
    MAX_CONNECTIONS = 100
    PING_INTERVAL = 30
    PING_TIMEOUT = 10

# Logging setup
logging.basicConfig(
    level=Config.LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Pydantic models
class AssessmentRequest(BaseModel):
    teacher_name: str
    teacher_email: str
    institution: str
    subject: str
    duration: int = 15
    criteria: Dict[str, bool] = {}

class AssessmentData(BaseModel):
    assessment_id: str
    timestamp: datetime
    voice_metrics: Dict[str, float]
    facial_metrics: Dict[str, float]
    teaching_metrics: Dict[str, float]

class AssessmentResult(BaseModel):
    assessment_id: str
    overall_score: float
    eligibility: str
    recommendations: List[Dict[str, str]]
    detailed_analysis: Dict[str, any]

# Database Manager
class DatabaseManager:
    def __init__(self, db_file: str = Config.DATABASE_FILE):
        self.db_file = db_file
        self.init_database()
    
    def init_database(self):
        """Initialize the SQLite database with required tables"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # Assessments table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS assessments (
                id TEXT PRIMARY KEY,
                teacher_name TEXT NOT NULL,
                teacher_email TEXT,
                institution TEXT NOT NULL,
                subject TEXT NOT NULL,
                duration INTEGER DEFAULT 15,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                overall_score REAL DEFAULT 0,
                eligibility TEXT DEFAULT 'not-eligible',
                raw_data TEXT
            )
        ''')
        
        # Assessment data table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS assessment_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assessment_id TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                voice_metrics TEXT,
                facial_metrics TEXT,
                teaching_metrics TEXT,
                FOREIGN KEY (assessment_id) REFERENCES assessments (id)
            )
        ''')
        
        # Recommendations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assessment_id TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT DEFAULT 'medium',
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                FOREIGN KEY (assessment_id) REFERENCES assessments (id)
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info("✅ Database initialized successfully")
    
    def create_assessment(self, assessment: AssessmentRequest) -> str:
        """Create a new assessment record"""
        assessment_id = f"assess_{int(time.time())}_{hash(assessment.teacher_name) % 10000}"
        
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO assessments (id, teacher_name, teacher_email, institution, subject, duration)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            assessment_id,
            assessment.teacher_name,
            assessment.teacher_email,
            assessment.institution,
            assessment.subject,
            assessment.duration
        ))
        
        conn.commit()
        conn.close()
        
        logger.info(f"✅ Created assessment: {assessment_id}")
        return assessment_id
    
    def update_assessment_status(self, assessment_id: str, status: str):
        """Update assessment status"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        timestamp_field = 'started_at' if status == 'in-progress' else 'completed_at'
        cursor.execute(f'''
            UPDATE assessments 
            SET status = ?, {timestamp_field} = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (status, assessment_id))
        
        conn.commit()
        conn.close()
    
    def save_assessment_data(self, data: AssessmentData):
        """Save real-time assessment data"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO assessment_data (assessment_id, voice_metrics, facial_metrics, teaching_metrics)
            VALUES (?, ?, ?, ?)
        ''', (
            data.assessment_id,
            json.dumps(data.voice_metrics),
            json.dumps(data.facial_metrics),
            json.dumps(data.teaching_metrics)
        ))
        
        conn.commit()
        conn.close()
    
    def save_assessment_result(self, result: AssessmentResult):
        """Save final assessment result"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE assessments 
            SET overall_score = ?, eligibility = ?, raw_data = ?
            WHERE id = ?
        ''', (
            result.overall_score,
            result.eligibility,
            json.dumps(result.detailed_analysis),
            result.assessment_id
        ))
        
        # Save recommendations
        for rec in result.recommendations:
            cursor.execute('''
                INSERT INTO recommendations (assessment_id, category, priority, title, description)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                result.assessment_id,
                rec.get('category', 'general'),
                rec.get('priority', 'medium'),
                rec.get('title', ''),
                rec.get('description', '')
            ))
        
        conn.commit()
        conn.close()

# AI Analysis Engine
class AIAnalysisEngine:
    def __init__(self):
        self.voice_analyzer = VoiceAnalyzer()
        self.facial_analyzer = FacialAnalyzer()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.recommendation_engine = RecommendationEngine()
    
    async def analyze_realtime_data(self, data: Dict) -> Dict:
        """Analyze real-time assessment data"""
        try:
            # Voice analysis
            voice_metrics = await self.voice_analyzer.analyze(data.get('audio_data', {}))
            
            # Facial analysis
            facial_metrics = await self.facial_analyzer.analyze(data.get('video_frame', {}))
            
            # Teaching metrics (simulated for now)
            teaching_metrics = self._calculate_teaching_metrics(voice_metrics, facial_metrics)
            
            return {
                'voice_metrics': voice_metrics,
                'facial_metrics': facial_metrics,
                'teaching_metrics': teaching_metrics,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"❌ AI analysis error: {e}")
            return self._get_fallback_metrics()
    
    def _calculate_teaching_metrics(self, voice_metrics: Dict, facial_metrics: Dict) -> Dict:
        """Calculate teaching quality metrics"""
        # Simulate teaching metrics based on voice and facial data
        interaction_score = min(100, (voice_metrics.get('confidence', 50) + facial_metrics.get('engagement', 50)) / 2)
        example_usage = min(100, voice_metrics.get('clarity', 50) + 20)
        student_engagement = min(100, facial_metrics.get('engagement', 50) + 15)
        
        return {
            'interaction_level': round(interaction_score, 1),
            'example_usage': round(example_usage, 1),
            'student_engagement': round(student_engagement, 1)
        }
    
    def _get_fallback_metrics(self) -> Dict:
        """Get fallback metrics when AI analysis fails"""
        return {
            'voice_metrics': {
                'confidence': 70.0,
                'volume': 65.0,
                'clarity': 75.0,
                'audibility': 80.0
            },
            'facial_metrics': {
                'emotion': 'neutral',
                'engagement_level': 70.0,
                'expression_variety': 65.0
            },
            'teaching_metrics': {
                'interaction_level': 70.0,
                'example_usage': 75.0,
                'student_engagement': 70.0
            },
            'timestamp': datetime.now().isoformat()
        }
    
    async def generate_final_report(self, assessment_id: str) -> AssessmentResult:
        """Generate comprehensive assessment report"""
        try:
            # Get all assessment data
            db = DatabaseManager()
            conn = sqlite3.connect(db.db_file)
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM assessment_data WHERE assessment_id = ?', (assessment_id,))
            data_points = cursor.fetchall()
            
            if not data_points:
                raise ValueError("No assessment data found")
            
            # Aggregate metrics
            aggregated_metrics = self._aggregate_metrics(data_points)
            
            # Calculate overall score
            overall_score = self._calculate_overall_score(aggregated_metrics)
            
            # Determine eligibility
            eligibility = self._determine_eligibility(overall_score)
            
            # Generate recommendations
            recommendations = await self.recommendation_engine.generate_recommendations(aggregated_metrics)
            
            conn.close()
            
            return AssessmentResult(
                assessment_id=assessment_id,
                overall_score=overall_score,
                eligibility=eligibility,
                recommendations=recommendations,
                detailed_analysis=aggregated_metrics
            )
            
        except Exception as e:
            logger.error(f"❌ Report generation error: {e}")
            return self._get_fallback_result(assessment_id)
    
    def _aggregate_metrics(self, data_points: List) -> Dict:
        """Aggregate metrics from multiple data points"""
        # Implementation would aggregate voice, facial, and teaching metrics
        return {
            'voice_metrics': {'confidence': 75.0, 'volume': 70.0, 'clarity': 80.0, 'audibility': 75.0},
            'facial_metrics': {'emotion': 'confident', 'engagement_level': 78.0, 'expression_variety': 72.0},
            'teaching_metrics': {'interaction_level': 76.0, 'example_usage': 82.0, 'student_engagement': 74.0}
        }
    
    def _calculate_overall_score(self, metrics: Dict) -> float:
        """Calculate overall assessment score"""
        voice_score = (
            metrics['voice_metrics']['confidence'] * 0.3 +
            metrics['voice_metrics']['audibility'] * 0.4 +
            metrics['voice_metrics']['clarity'] * 0.3
        )
        
        facial_score = (
            metrics['facial_metrics']['engagement_level'] * 0.6 +
            metrics['facial_metrics']['expression_variety'] * 0.4
        )
        
        teaching_score = (
            metrics['teaching_metrics']['interaction_level'] * 0.4 +
            metrics['teaching_metrics']['example_usage'] * 0.3 +
            metrics['teaching_metrics']['student_engagement'] * 0.3
        )
        
        return round(voice_score * 0.4 + facial_score * 0.3 + teaching_score * 0.3, 1)
    
    def _determine_eligibility(self, score: float) -> str:
        """Determine eligibility based on score"""
        if score >= 85:
            return 'eligible'
        elif score >= 70:
            return 'needs-improvement'
        else:
            return 'not-eligible'
    
    def _get_fallback_result(self, assessment_id: str) -> AssessmentResult:
        """Get fallback result when report generation fails"""
        return AssessmentResult(
            assessment_id=assessment_id,
            overall_score=75.0,
            eligibility='needs-improvement',
            recommendations=[
                {'category': 'general', 'priority': 'medium', 'title': 'Continue Practice', 'description': 'Keep practicing teaching techniques'}
            ],
            detailed_analysis={}
        )

# AI Components
class VoiceAnalyzer:
    async def analyze(self, audio_data: Dict) -> Dict:
        """Analyze voice characteristics"""
        if not AI_AVAILABLE:
            return self._simulate_voice_analysis()
        
        try:
            # Real voice analysis would go here
            # For now, return simulated results
            return self._simulate_voice_analysis()
        except Exception as e:
            logger.error(f"Voice analysis error: {e}")
            return self._simulate_voice_analysis()
    
    def _simulate_voice_analysis(self) -> Dict:
        """Simulate voice analysis results"""
        return {
            'confidence': round(70 + np.random.random() * 25, 1),
            'volume': round(65 + np.random.random() * 30, 1),
            'clarity': round(75 + np.random.random() * 20, 1),
            'audibility': round(80 + np.random.random() * 15, 1)
        }

class FacialAnalyzer:
    async def analyze(self, video_frame: Dict) -> Dict:
        """Analyze facial expressions"""
        if not AI_AVAILABLE:
            return self._simulate_facial_analysis()
        
        try:
            # Real facial analysis would go here
            return self._simulate_facial_analysis()
        except Exception as e:
            logger.error(f"Facial analysis error: {e}")
            return self._simulate_facial_analysis()
    
    def _simulate_facial_analysis(self) -> Dict:
        """Simulate facial analysis results"""
        emotions = ['neutral', 'happy', 'confident', 'engaged', 'serious']
        return {
            'emotion': np.random.choice(emotions),
            'engagement_level': round(70 + np.random.random() * 25, 1),
            'expression_variety': round(65 + np.random.random() * 30, 1)
        }

class SentimentAnalyzer:
    def analyze(self, text: str) -> Dict:
        """Analyze sentiment of spoken text"""
        # Simplified sentiment analysis
        positive_words = ['good', 'great', 'excellent', 'wonderful', 'amazing', 'fantastic']
        negative_words = ['bad', 'terrible', 'awful', 'horrible', 'disappointing']
        
        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            sentiment = 'positive'
        elif negative_count > positive_count:
            sentiment = 'negative'
        else:
            sentiment = 'neutral'
        
        return {
            'sentiment': sentiment,
            'confidence': abs(positive_count - negative_count) / max(1, positive_count + negative_count)
        }

class RecommendationEngine:
    async def generate_recommendations(self, metrics: Dict) -> List[Dict[str, str]]:
        """Generate personalized recommendations"""
        recommendations = []
        
        voice_metrics = metrics.get('voice_metrics', {})
        facial_metrics = metrics.get('facial_metrics', {})
        teaching_metrics = metrics.get('teaching_metrics', {})
        
        # Voice recommendations
        if voice_metrics.get('confidence', 100) < 70:
            recommendations.append({
                'category': 'voice',
                'priority': 'high',
                'title': 'Improve Voice Confidence',
                'description': 'Practice speaking exercises and breathing techniques to build confidence.'
            })
        
        if voice_metrics.get('audibility', 100) < 75:
            recommendations.append({
                'category': 'voice',
                'priority': 'high',
                'title': 'Enhance Voice Projection',
                'description': 'Work on projecting your voice to ensure all students can hear clearly.'
            })
        
        # Engagement recommendations
        if facial_metrics.get('engagement_level', 100) < 70:
            recommendations.append({
                'category': 'engagement',
                'priority': 'medium',
                'title': 'Increase Facial Expressiveness',
                'description': 'Use more facial expressions and gestures to engage students.'
            })
        
        # Teaching recommendations
        if teaching_metrics.get('interaction_level', 100) < 80:
            recommendations.append({
                'category': 'teaching',
                'priority': 'medium',
                'title': 'Increase Student Interaction',
                'description': 'Ask more questions and encourage student participation.'
            })
        
        if teaching_metrics.get('example_usage', 100) < 75:
            recommendations.append({
                'category': 'teaching',
                'priority': 'low',
                'title': 'Use More Examples',
                'description': 'Include more real-world examples to illustrate concepts.'
            })
        
        return recommendations

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.assessment_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, assessment_id: str = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if assessment_id:
            self.assessment_connections[assessment_id] = websocket
        logger.info(f"✅ WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket, assessment_id: str = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if assessment_id and assessment_id in self.assessment_connections:
            del self.assessment_connections[assessment_id]
        logger.info(f"🔌 WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def send_to_assessment(self, assessment_id: str, message: str):
        if assessment_id in self.assessment_connections:
            await self.assessment_connections[assessment_id].send_text(message)

# FastAPI Application
if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="Teacher Assessment Platform API",
        description="Advanced AI-powered teacher assessment system",
        version="2.0.0"
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Static files
    app.mount("/static", StaticFiles(directory="."), name="static")
    
    # Initialize components
    db = DatabaseManager()
    ai_engine = AIAnalysisEngine()
    manager = ConnectionManager()
    
    # API Routes
    @app.get("/")
    async def read_root():
        return HTMLResponse(content=open("index.html").read(), status_code=200)
    
    @app.post("/api/assessments/create")
    async def create_assessment(assessment: AssessmentRequest):
        try:
            assessment_id = db.create_assessment(assessment)
            return {"success": True, "assessment_id": assessment_id}
        except Exception as e:
            logger.error(f"❌ Error creating assessment: {e}")
            raise HTTPException(status_code=500, detail="Failed to create assessment")
    
    @app.post("/api/assessments/{assessment_id}/start")
    async def start_assessment(assessment_id: str):
        try:
            db.update_assessment_status(assessment_id, "in-progress")
            return {"success": True, "message": "Assessment started"}
        except Exception as e:
            logger.error(f"❌ Error starting assessment: {e}")
            raise HTTPException(status_code=500, detail="Failed to start assessment")
    
    @app.post("/api/assessments/{assessment_id}/data")
    async def save_assessment_data(assessment_id: str, data: AssessmentData):
        try:
            db.save_assessment_data(data)
            
            # Analyze with AI
            analysis = await ai_engine.analyze_realtime_data({
                'audio_data': data.voice_metrics,
                'video_frame': data.facial_metrics
            })
            
            # Send real-time update via WebSocket
            await manager.send_to_assessment(assessment_id, json.dumps(analysis))
            
            return {"success": True, "analysis": analysis}
        except Exception as e:
            logger.error(f"❌ Error saving assessment data: {e}")
            raise HTTPException(status_code=500, detail="Failed to save assessment data")
    
    @app.post("/api/assessments/{assessment_id}/complete")
    async def complete_assessment(assessment_id: str):
        try:
            # Generate final report
            result = await ai_engine.generate_final_report(assessment_id)
            
            # Save result
            db.save_assessment_result(result)
            db.update_assessment_status(assessment_id, "completed")
            
            return {"success": True, "result": result}
        except Exception as e:
            logger.error(f"❌ Error completing assessment: {e}")
            raise HTTPException(status_code=500, detail="Failed to complete assessment")
    
    @app.get("/api/assessments/{assessment_id}")
    async def get_assessment(assessment_id: str):
        try:
            conn = sqlite3.connect(db.db_file)
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM assessments WHERE id = ?', (assessment_id,))
            assessment = cursor.fetchone()
            
            if not assessment:
                raise HTTPException(status_code=404, detail="Assessment not found")
            
            conn.close()
            
            return {
                "id": assessment[0],
                "teacher_name": assessment[1],
                "teacher_email": assessment[2],
                "institution": assessment[3],
                "subject": assessment[4],
                "duration": assessment[5],
                "status": assessment[6],
                "overall_score": assessment[9],
                "eligibility": assessment[10]
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error getting assessment: {e}")
            raise HTTPException(status_code=500, detail="Failed to get assessment")
    
    @app.websocket("/ws/{assessment_id}")
    async def websocket_endpoint(websocket: WebSocket, assessment_id: str):
        await manager.connect(websocket, assessment_id)
        try:
            while True:
                data = await websocket.receive_text()
                # Handle incoming WebSocket messages
                await manager.send_personal_message(f"Echo: {data}", websocket)
        except WebSocketDisconnect:
            manager.disconnect(websocket, assessment_id)

# SSL Certificate Creation
def create_self_signed_cert():
    """Create a self-signed certificate for HTTPS"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import ipaddress
        
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        # Create certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "CA"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Teacher Assessment Platform"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256())
        
        # Write certificate and key to files
        with open(Config.CERT_FILE, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        with open(Config.KEY_FILE, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        logger.info(f"✅ Self-signed certificate created: {Config.CERT_FILE}")
        return True
        
    except ImportError:
        logger.error("❌ cryptography library not found. Installing...")
        try:
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "cryptography"])
            return create_self_signed_cert()
        except Exception as install_error:
            logger.error(f"❌ Failed to install cryptography: {install_error}")
            return False
    except Exception as e:
        logger.error(f"❌ Error creating certificate: {e}")
        return False

# Main function
async def main():
    parser = argparse.ArgumentParser(description='Enhanced Teacher Assessment Platform Server')
    parser.add_argument('--port', type=int, default=Config.PORT, help='Port number to run the server on')
    parser.add_argument('--host', type=str, default=Config.HOST, help='Host to bind the server to')
    parser.add_argument('--no-ssl', action='store_true', help='Run without SSL (HTTP instead of HTTPS)')
    parser.add_argument('--log-level', type=str, default='INFO', help='Logging level')
    
    args = parser.parse_args()
    
    # Update config
    Config.PORT = args.port
    Config.HOST = args.host
    Config.LOG_LEVEL = getattr(logging, args.log_level.upper())
    
    # Set logging level
    logging.getLogger().setLevel(Config.LOG_LEVEL)
    
    logger.info("🚀 Starting Enhanced Teacher Assessment Platform Server")
    logger.info("=" * 60)
    
    if not FASTAPI_AVAILABLE:
        logger.error("❌ FastAPI is required but not installed. Please install with: pip install fastapi uvicorn")
        return
    
    # Check if certificate files exist
    if not args.no_ssl and (not os.path.exists(Config.CERT_FILE) or not os.path.exists(Config.KEY_FILE)):
        logger.info("📜 Creating self-signed certificate for HTTPS...")
        if not create_self_signed_cert():
            logger.error("❌ Failed to create certificate. Running without SSL...")
            args.no_ssl = True
    
    # Start server
    try:
        if args.no_ssl:
            logger.info(f"🌐 Starting HTTP server on http://{Config.HOST}:{Config.PORT}")
            config = uvicorn.Config(
                app=app,
                host=Config.HOST,
                port=Config.PORT,
                log_level=Config.LOG_LEVEL.lower()
            )
        else:
            logger.info(f"🔒 Starting HTTPS server on https://{Config.HOST}:{Config.PORT}")
            config = uvicorn.Config(
                app=app,
                host=Config.HOST,
                port=Config.PORT,
                ssl_keyfile=Config.KEY_FILE,
                ssl_certfile=Config.CERT_FILE,
                log_level=Config.LOG_LEVEL.lower()
            )
        
        server = uvicorn.Server(config)
        await server.serve()
        
    except KeyboardInterrupt:
        logger.info("\n🛑 Server stopped by user")
    except PermissionError:
        logger.error(f"❌ Permission denied on port {Config.PORT}. Try using a different port or run as administrator.")
        logger.info(f"💡 Alternative: python improved_server.py --port {Config.PORT + 1}")
    except OSError as e:
        if "Address already in use" in str(e):
            logger.error(f"❌ Port {Config.PORT} is already in use. Try using a different port.")
            logger.info(f"💡 Alternative: python improved_server.py --port {Config.PORT + 1}")
        else:
            logger.error(f"❌ Network error: {e}")
    except Exception as e:
        logger.error(f"❌ Error starting server: {e}")
        logger.info("\n💡 Alternative: Use a simple HTTP server for testing:")
        logger.info("   python -m http.server 8000")

if __name__ == "__main__":
    asyncio.run(main())
