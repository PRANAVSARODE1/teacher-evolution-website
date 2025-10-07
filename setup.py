#!/usr/bin/env python3
"""
Setup script for Teacher Assessment Platform
Automates the installation and configuration process
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def run_command(command, cwd=None):
    """Run a command and return success status"""
    try:
        result = subprocess.run(command, shell=True, cwd=cwd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {command}")
            return True
        else:
            print(f"❌ {command}")
            print(f"Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ {command} - Exception: {e}")
        return False

def check_prerequisites():
    """Check if required software is installed"""
    print("🔍 Checking prerequisites...")
    
    # Check Node.js
    if not run_command("node --version"):
        print("❌ Node.js not found. Please install Node.js from https://nodejs.org/")
        return False
    
    # Check npm
    if not run_command("npm --version"):
        print("❌ npm not found. Please install npm")
        return False
    
    # Check Python
    if not run_command("python --version"):
        print("❌ Python not found. Please install Python from https://python.org/")
        return False
    
    # Check MongoDB (optional)
    if not run_command("mongod --version"):
        print("⚠️  MongoDB not found. Please install MongoDB from https://mongodb.com/")
        print("   The application will work without MongoDB but with limited features.")
    
    print("✅ Prerequisites check completed")
    return True

def setup_backend():
    """Setup the backend"""
    print("\n🚀 Setting up backend...")
    
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print("❌ Backend directory not found")
        return False
    
    # Install dependencies
    if not run_command("npm install", cwd=backend_dir):
        print("❌ Failed to install backend dependencies")
        return False
    
    # Create .env file if it doesn't exist
    env_file = backend_dir / ".env"
    if not env_file.exists():
        env_example = backend_dir / "env.example"
        if env_example.exists():
            shutil.copy(env_example, env_file)
            print("✅ Created .env file from example")
        else:
            # Create basic .env file
            with open(env_file, 'w') as f:
                f.write("""# Database Configuration
MONGODB_URI=mongodb://localhost:27017/teacher-assessment

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# AI Services Configuration (Optional)
OPENAI_API_KEY=your-openai-api-key
GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key
AZURE_SPEECH_KEY=your-azure-speech-key
AZURE_SPEECH_REGION=your-azure-speech-region

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
""")
            print("✅ Created basic .env file")
    
    print("✅ Backend setup completed")
    return True

def setup_frontend():
    """Setup the frontend"""
    print("\n🎨 Setting up frontend...")
    
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print("❌ Frontend directory not found")
        return False
    
    # Install dependencies
    if not run_command("npm install", cwd=frontend_dir):
        print("❌ Failed to install frontend dependencies")
        return False
    
    print("✅ Frontend setup completed")
    return True

def install_python_dependencies():
    """Install Python dependencies"""
    print("\n🐍 Installing Python dependencies...")
    
    python_deps = [
        "fastapi",
        "uvicorn",
        "cryptography",
        "numpy",
        "opencv-python",
        "tensorflow",
        "librosa",
        "SpeechRecognition",
        "pydantic",
        "python-multipart"
    ]
    
    for dep in python_deps:
        if not run_command(f"pip install {dep}"):
            print(f"⚠️  Failed to install {dep} - continuing...")
    
    print("✅ Python dependencies installation completed")
    return True

def create_startup_scripts():
    """Create startup scripts for easy development"""
    print("\n📝 Creating startup scripts...")
    
    # Backend startup script
    backend_script = """@echo off
echo Starting Teacher Assessment Backend...
cd backend
npm run dev
pause
"""
    
    with open("start_backend.bat", "w") as f:
        f.write(backend_script)
    
    # Frontend startup script
    frontend_script = """@echo off
echo Starting Teacher Assessment Frontend...
cd frontend
npm run dev
pause
"""
    
    with open("start_frontend.bat", "w") as f:
        f.write(frontend_script)
    
    # Python server startup script
    python_script = """@echo off
echo Starting Enhanced Python Server...
python improved_server.py
pause
"""
    
    with open("start_python_server.bat", "w") as f:
        f.write(python_script)
    
    print("✅ Startup scripts created")
    print("   - start_backend.bat")
    print("   - start_frontend.bat") 
    print("   - start_python_server.bat")
    return True

def print_next_steps():
    """Print next steps for the user"""
    print("\n🎉 Setup completed successfully!")
    print("\n📋 Next Steps:")
    print("1. Start MongoDB (if installed):")
    print("   - Windows: net start MongoDB")
    print("   - macOS/Linux: sudo systemctl start mongod")
    
    print("\n2. Configure API Keys (Optional):")
    print("   - Edit backend/.env file")
    print("   - Add your OpenAI, Azure, or Google Cloud API keys")
    
    print("\n3. Start the application:")
    print("   Option A - Full Stack (Recommended):")
    print("   - Run: start_backend.bat (in one terminal)")
    print("   - Run: start_frontend.bat (in another terminal)")
    print("   - Access: http://localhost:3000")
    
    print("\n   Option B - Python Server:")
    print("   - Run: start_python_server.bat")
    print("   - Access: https://localhost:8443")
    
    print("\n4. Default Login:")
    print("   - Register a new account or use demo credentials")
    
    print("\n📚 Documentation:")
    print("   - Read README.md for detailed instructions")
    print("   - Check API documentation at http://localhost:5000/api/docs")
    
    print("\n🆘 Support:")
    print("   - Check troubleshooting section in README.md")
    print("   - Create an issue if you encounter problems")

def main():
    """Main setup function"""
    print("🎓 Teacher Assessment Platform Setup")
    print("=" * 50)
    
    # Check prerequisites
    if not check_prerequisites():
        print("\n❌ Prerequisites not met. Please install required software.")
        return False
    
    # Setup backend
    if not setup_backend():
        print("\n❌ Backend setup failed.")
        return False
    
    # Setup frontend
    if not setup_frontend():
        print("\n❌ Frontend setup failed.")
        return False
    
    # Install Python dependencies
    install_python_dependencies()
    
    # Create startup scripts
    create_startup_scripts()
    
    # Print next steps
    print_next_steps()
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        if success:
            print("\n✅ Setup completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Setup failed!")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
