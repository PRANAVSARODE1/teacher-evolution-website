#!/usr/bin/env python3
"""
Startup script for Teacher Assessment Platform Backend
Ensures the Flask server runs on the correct port (8080)
"""

import sys
import os
import subprocess
import time
import requests
from pathlib import Path

def check_port_available(port):
    """Check if a port is available"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) != 0

def wait_for_server(port, timeout=30):
    """Wait for server to be ready"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f'http://localhost:{port}/health', timeout=2)
            if response.status_code == 200:
                return True
        except:
            pass
        time.sleep(1)
    return False

def main():
    print("🚀 Starting Teacher Assessment Platform Backend")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists('backend/flask_app.py'):
        print("❌ Error: backend/flask_app.py not found")
        print("Please run this script from the project root directory")
        sys.exit(1)
    
    # Check if port 8080 is available
    if not check_port_available(8080):
        print("⚠️  Port 8080 is already in use")
        print("Trying to start anyway...")
    
    # Install requirements if needed
    print("📦 Checking dependencies...")
    try:
        import flask
        import flask_cors
        import pymongo
        import jwt
    except ImportError:
        print("📦 Installing required packages...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], check=True)
    
    # Start the Flask server
    print("🌐 Starting Flask server on http://localhost:8080")
    print("📝 Backend will be available at: http://localhost:8080")
    print("🔗 Health check: http://localhost:8080/health")
    print("🔗 Registration: http://localhost:8080/api/auth/register")
    print("=" * 50)
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        # Change to backend directory and run Flask app
        os.chdir('backend')
        subprocess.run([sys.executable, 'flask_app.py'], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
