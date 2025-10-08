#!/usr/bin/env python3
"""
Flask-based Teacher Assessment Platform Backend
Simplified approach to avoid pydantic_core compilation issues
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pymongo
import jwt
import os
import json
from datetime import datetime, timedelta
from bson import ObjectId
from werkzeug.utils import secure_filename
import uuid

app = Flask(__name__)
CORS(app)

# Configuration
MONGODB_URI = "mongodb+srv://aiproject:px2e0JPBGFtFJX96@cluster0.vhuq7hn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
MONGO_DB_NAME = "teacher_assessment"
JWT_SECRET = "change-this-secret"
UPLOAD_FOLDER = os.path.join(os.getcwd(), "backend", "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# MongoDB connection
try:
    client = pymongo.MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]
    print("✅ Connected to MongoDB")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    db = None

# Helper functions
def create_token(user_id, role):
    payload = {
        'sub': str(user_id),
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except:
        return None

def require_auth(f):
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Invalid token'}), 401
        
        request.user = payload
        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated

def require_role(roles):
    def decorator(f):
        def decorated(*args, **kwargs):
            if not hasattr(request, 'user'):
                return jsonify({'error': 'Not authenticated'}), 401
            
            if request.user.get('role') not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        decorated.__name__ = f.__name__
        return decorated
    return decorator

# Routes
@app.route('/health', methods=['GET'])
def health():
    try:
        if db:
            db.command('ping')
            return jsonify({'status': 'ok', 'mongodb': 'connected'})
        else:
            return jsonify({'status': 'ok', 'mongodb': 'disconnected'})
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'role']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing {field}'}), 400
        
        # Validate role
        if data['role'] not in ['admin', 'evaluator', 'teacher']:
            return jsonify({'error': 'Invalid role'}), 400
        
        # Check if user exists
        if db and db.users.find_one({'email': data['email']}):
            return jsonify({'error': 'User already exists'}), 409
        
        # Create user
        user_data = {
            'name': data['name'],
            'email': data['email'],
            'role': data['role'],
            'password_hash': data.get('password', ''),
            'created_at': datetime.utcnow()
        }
        
        if db:
            result = db.users.insert_one(user_data)
            user_id = str(result.inserted_id)
        else:
            user_id = str(uuid.uuid4())
        
        return jsonify({'success': True, 'user_id': user_id})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({'error': 'Email required'}), 400
        
        # Find user
        if db:
            user = db.users.find_one({'email': data['email']})
        else:
            # Mock user for testing
            user = {
                '_id': ObjectId(),
                'email': data['email'],
                'role': 'admin',
                'password_hash': 'admin123'
            }
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password (simple comparison for demo)
        if user.get('password_hash') and data.get('password') != user['password_hash']:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create token
        token = create_token(user['_id'], user['role'])
        
        return jsonify({
            'success': True,
            'access_token': token,
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'role': user['role']
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assessments', methods=['POST'])
@require_auth
@require_role(['admin', 'evaluator'])
def create_assessment():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['teacher_name', 'institution', 'subject']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing {field}'}), 400
        
        # Create assessment
        assessment_data = {
            'teacher_name': data['teacher_name'],
            'teacher_email': data.get('teacher_email'),
            'institution': data['institution'],
            'subject': data['subject'],
            'duration': data.get('duration', 15),
            'criteria': data.get('criteria', {}),
            'status': 'pending',
            'created_by': request.user['sub'],
            'created_at': datetime.utcnow()
        }
        
        if db:
            result = db.assessments.insert_one(assessment_data)
            assessment_id = str(result.inserted_id)
        else:
            assessment_id = str(uuid.uuid4())
        
        return jsonify({'success': True, 'assessment_id': assessment_id})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assessments/<assessment_id>/start', methods=['POST'])
@require_auth
@require_role(['admin', 'evaluator'])
def start_assessment(assessment_id):
    try:
        if db:
            db.assessments.update_one(
                {'_id': ObjectId(assessment_id)},
                {'$set': {'status': 'in-progress', 'started_at': datetime.utcnow()}}
            )
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assessments/<assessment_id>/data', methods=['POST'])
@require_auth
def push_assessment_data(assessment_id):
    try:
        data = request.get_json()
        
        # Add metadata
        data['assessment_id'] = assessment_id
        data['timestamp'] = datetime.utcnow()
        data['user_id'] = request.user['sub']
        
        if db:
            db.assessment_data.insert_one(data)
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assessments/<assessment_id>/complete', methods=['POST'])
@require_auth
@require_role(['admin', 'evaluator'])
def complete_assessment(assessment_id):
    try:
        if db:
            db.assessments.update_one(
                {'_id': ObjectId(assessment_id)},
                {'$set': {'status': 'completed', 'completed_at': datetime.utcnow()}}
            )
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/uploads/video/<assessment_id>', methods=['POST'])
@require_auth
def upload_video(assessment_id):
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Generate unique filename
        filename = f"{assessment_id}_{int(datetime.utcnow().timestamp())}_{secure_filename(file.filename)}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Save file
        file.save(filepath)
        
        # Record upload
        upload_data = {
            'assessment_id': assessment_id,
            'filename': filename,
            'filepath': filepath,
            'size': os.path.getsize(filepath),
            'uploaded_by': request.user['sub'],
            'created_at': datetime.utcnow()
        }
        
        if db:
            db.uploads.insert_one(upload_data)
        
        return jsonify({'success': True, 'filename': filename})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcripts/<assessment_id>/append', methods=['POST'])
@require_auth
def append_transcript(assessment_id):
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        # Simple keyword detection
        keywords = ['example', 'homework', 'exam', 'project', 'definition']
        found_keywords = [k for k in keywords if k.lower() in text.lower()]
        
        transcript_data = {
            'assessment_id': assessment_id,
            'text': text,
            'keywords': found_keywords,
            'timestamp': datetime.utcnow(),
            'user_id': request.user['sub']
        }
        
        if db:
            db.transcripts.insert_one(transcript_data)
        
        return jsonify({'success': True, 'keywords': found_keywords})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/feedback/goals', methods=['POST'])
@require_auth
@require_role(['admin', 'evaluator'])
def create_goal():
    try:
        data = request.get_json()
        
        goal_data = {
            'teacher_email': data['teacher_email'],
            'title': data['title'],
            'description': data.get('description'),
            'acknowledged': False,
            'created_by': request.user['sub'],
            'created_at': datetime.utcnow()
        }
        
        if db:
            result = db.goals.insert_one(goal_data)
            goal_id = str(result.inserted_id)
        else:
            goal_id = str(uuid.uuid4())
        
        return jsonify({'success': True, 'goal_id': goal_id})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/feedback/goals/<goal_id>/acknowledge', methods=['POST'])
@require_auth
@require_role(['teacher'])
def acknowledge_goal(goal_id):
    try:
        if db:
            db.goals.update_one(
                {'_id': ObjectId(goal_id)},
                {'$set': {
                    'acknowledged': True,
                    'acknowledged_at': datetime.utcnow(),
                    'acknowledged_by': request.user['sub']
                }}
            )
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/feedback/teacher/<teacher_email>', methods=['GET'])
def get_teacher_feedback(teacher_email):
    try:
        goals = []
        followups = []
        
        if db:
            goals = list(db.goals.find({'teacher_email': teacher_email}))
            followups = list(db.followups.find({'teacher_email': teacher_email}))
            
            # Convert ObjectId to string
            for goal in goals:
                goal['_id'] = str(goal['_id'])
            for followup in followups:
                followup['_id'] = str(followup['_id'])
        
        return jsonify({'goals': goals, 'followups': followups})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/config/criteria', methods=['POST'])
@require_auth
@require_role(['admin'])
def set_criteria():
    try:
        data = request.get_json()
        
        criteria_data = {
            'org': data['org'],
            'weights': data['weights'],
            'version': data.get('version', 1),
            'updated_by': request.user['sub'],
            'updated_at': datetime.utcnow()
        }
        
        if db:
            db.criteria.update_one(
                {'org': data['org']},
                {'$set': criteria_data},
                upsert=True
            )
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/config/criteria/<org>', methods=['GET'])
def get_criteria(org):
    try:
        if db:
            criteria = db.criteria.find_one({'org': org})
            if criteria:
                criteria['_id'] = str(criteria['_id'])
                return jsonify(criteria)
            else:
                return jsonify({'error': 'No config found'}), 404
        else:
            return jsonify({'error': 'Database not available'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Flask Teacher Assessment Backend")
    print(f"📁 Upload folder: {UPLOAD_FOLDER}")
    print(f"🗄️  MongoDB: {'Connected' if db else 'Disconnected'}")
    app.run(host='0.0.0.0', port=8080, debug=True)


