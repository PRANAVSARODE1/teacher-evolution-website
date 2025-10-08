#!/usr/bin/env python3
"""
Test script to verify account registration works
"""

import requests
import json
import time

def test_registration():
    """Test the registration endpoint"""
    base_url = "http://localhost:8080"
    
    print("🧪 Testing Account Registration")
    print("=" * 40)
    
    # Test data
    test_user = {
        "name": "Test Teacher",
        "email": "test@example.com",
        "password": "testpass123",
        "role": "teacher"
    }
    
    try:
        # Test health endpoint first
        print("1. Testing health endpoint...")
        health_response = requests.get(f"{base_url}/health", timeout=5)
        if health_response.status_code == 200:
            print("✅ Health check passed")
        else:
            print("❌ Health check failed")
            return False
        
        # Test registration
        print("2. Testing registration...")
        reg_response = requests.post(
            f"{base_url}/api/auth/register",
            headers={"Content-Type": "application/json"},
            json=test_user,
            timeout=10
        )
        
        print(f"Status Code: {reg_response.status_code}")
        print(f"Response: {reg_response.text}")
        
        if reg_response.status_code == 200:
            data = reg_response.json()
            if data.get('success'):
                print("✅ Registration successful!")
                print(f"User ID: {data.get('user_id')}")
                return True
            else:
                print("❌ Registration failed - no success flag")
                return False
        else:
            print("❌ Registration failed")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server")
        print("Make sure the backend is running on port 8080")
        return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

def test_duplicate_registration():
    """Test duplicate registration (should fail)"""
    base_url = "http://localhost:8080"
    
    print("\n3. Testing duplicate registration...")
    
    test_user = {
        "name": "Test Teacher",
        "email": "test@example.com",
        "password": "testpass123",
        "role": "teacher"
    }
    
    try:
        reg_response = requests.post(
            f"{base_url}/api/auth/register",
            headers={"Content-Type": "application/json"},
            json=test_user,
            timeout=10
        )
        
        if reg_response.status_code == 409:
            print("✅ Duplicate registration correctly rejected")
            return True
        else:
            print(f"❌ Expected 409 status, got {reg_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Duplicate test failed: {e}")
        return False

if __name__ == '__main__':
    print("Starting registration tests...")
    print("Make sure the backend server is running!")
    print("Run: python start_backend.py")
    print("=" * 50)
    
    # Wait a moment for user to read
    time.sleep(2)
    
    success1 = test_registration()
    success2 = test_duplicate_registration()
    
    if success1 and success2:
        print("\n🎉 All tests passed! Registration is working correctly.")
    else:
        print("\n❌ Some tests failed. Check the backend server.")
