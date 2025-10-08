#!/usr/bin/env python3
"""
Simple Flask Backend for Teacher Assessment Platform
No MongoDB dependency - uses local storage
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

# Simple in-memory storage
users_db = []
assessments_db = []

# Helper functions
def save_data():
    """Save data to local JSON files"""
    try:
        with open('users.json', 'w') as f:
            json.dump(users_db, f)
        with open('assessments.json', 'w') as f:
            json.dump(assessments_db, f)
    except Exception as e:
        print(f"Error saving data: {e}")

def load_data():
    """Load data from local JSON files"""
    global users_db, assessments_db
    try:
        if os.path.exists('users.json'):
            with open('users.json', 'r') as f:
                users_db = json.load(f)
        if os.path.exists('assessments.json'):
            with open('assessments.json', 'r') as f:
                assessments_db = json.load(f)
    except Exception as e:
        print(f"Error loading data: {e}")

# Load existing data on startup
load_data()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Simple backend running'})

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'password']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing {field}'}), 400
        
        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password strength
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Set default role if not provided
        role = data.get('role', 'teacher')
        if role not in ['admin', 'evaluator', 'teacher']:
            role = 'teacher'
        
        # Check if user exists
        existing_user = next((u for u in users_db if u['email'] == data['email']), None)
        if existing_user:
            return jsonify({'error': 'User already exists'}), 409
        
        # Create user
        user_data = {
            'id': str(uuid.uuid4()),
            'name': data['name'],
            'email': data['email'],
            'role': role,
            'password_hash': data['password'],  # Store password directly for demo
            'created_at': datetime.utcnow().isoformat()
        }
        
        users_db.append(user_data)
        save_data()
        
        return jsonify({'success': True, 'user_id': user_data['id'], 'message': 'Account created successfully'})
    
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({'error': 'Email required'}), 400
        
        # Find user
        user = next((u for u in users_db if u['email'] == data['email']), None)
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password (simple comparison for demo)
        if user.get('password_hash') and data.get('password') != user['password_hash']:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        return jsonify({
            'success': True,
            'access_token': 'demo-token',
            'user': {
                'id': user['id'],
                'email': user['email'],
                'role': user['role']
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assessments', methods=['POST'])
def create_assessment():
    try:
        data = request.get_json()
        
        assessment_data = {
            'id': str(uuid.uuid4()),
            'teacher_name': data.get('teacher_name', ''),
            'institution': data.get('institution', ''),
            'subject': data.get('subject', ''),
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat()
        }
        
        assessments_db.append(assessment_data)
        save_data()
        
        return jsonify({'success': True, 'assessment_id': assessment_data['id']})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Simple Flask Backend")
    print("No MongoDB required - using local storage")
    print("Backend will be available at: http://localhost:8080")
    print("Health check: http://localhost:8080/health")
    print("=" * 50)
    app.run(host='0.0.0.0', port=8080, debug=True)
