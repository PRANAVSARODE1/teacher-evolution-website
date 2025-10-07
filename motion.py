#!/usr/bin/env python3
"""
Simple HTTPS server for Teacher Eligibility Assessment Platform
This ensures microphone access works properly (requires HTTPS)
"""

import http.server
import ssl
import socketserver
import os
import sys
import ipaddress
import argparse

# Configuration
PORT = 8443
CERT_FILE = 'server.crt'
KEY_FILE = 'server.key'

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def create_self_signed_cert():
    """Create a self-signed certificate for HTTPS"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime
        
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
            datetime.datetime.utcnow()
        ).not_valid_after(
            datetime.datetime.utcnow() + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256())
        
        # Write certificate and key to files
        with open(CERT_FILE, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        with open(KEY_FILE, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        print(f"✅ Self-signed certificate created: {CERT_FILE}")
        return True
        
    except ImportError:
        print("❌ cryptography library not found. Installing...")
        try:
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "cryptography"])
            return create_self_signed_cert()
        except Exception as install_error:
            print(f"❌ Failed to install cryptography: {install_error}")
            return False
    except Exception as e:
        print(f"❌ Error creating certificate: {e}")
        return False

def main():
    global PORT
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Teacher Eligibility Assessment Platform Server')
    parser.add_argument('--port', type=int, default=8443, help='Port number to run the server on (default: 8443)')
    args = parser.parse_args()
    
    PORT = args.port
    
    print("🚀 Starting Teacher Eligibility Assessment Platform Server")
    print("=" * 60)
    
    # Check if certificate files exist
    if not os.path.exists(CERT_FILE) or not os.path.exists(KEY_FILE):
        print("📜 Creating self-signed certificate for HTTPS...")
        if not create_self_signed_cert():
            print("❌ Failed to create certificate. Exiting.")
            sys.exit(1)
    
    # Create HTTPS server
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            # Wrap with SSL
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(CERT_FILE, KEY_FILE)
            httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
            
            print(f"✅ Server running at: https://localhost:{PORT}")
            print(f"✅ Server running at: https://127.0.0.1:{PORT}")
            print("=" * 60)
            print("📋 Instructions:")
            print(f"1. Open your browser and go to: https://localhost:{PORT}")
            print("2. Click 'Advanced' if you see a security warning")
            print("3. Click 'Proceed to localhost (unsafe)'")
            print("4. Allow camera and microphone permissions when prompted")
            print("5. Start your teacher assessment!")
            print("=" * 60)
            print("Press Ctrl+C to stop the server")
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except PermissionError:
        print(f"❌ Permission denied on port {PORT}. Try using a different port or run as administrator.")
        print(f"💡 Alternative: python motion.py --port 8444")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {PORT} is already in use. Try using a different port.")
            print(f"💡 Alternative: python motion.py --port 8444")
        else:
            print(f"❌ Network error: {e}")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        print("\n💡 Alternative: Use a simple HTTP server for testing:")
        print("   python -m http.server 8000")
        print("   (Note: Microphone may not work without HTTPS)")

if __name__ == "__main__":
    main()
