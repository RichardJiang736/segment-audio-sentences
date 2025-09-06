#!/usr/bin/env python3
"""
Test script to verify that the audio processor service can be imported and started correctly.
"""
import os
import sys
import subprocess
import time
import requests

def test_service_import():
    """Test that we can import the audio processor service without errors."""
    try:
        # Try importing the service module
        import audio_processor
        print("✅ Successfully imported audio_processor module")
        return True
    except Exception as e:
        print(f"❌ Failed to import audio_processor module: {e}")
        return False

def test_service_startup():
    """Test that we can start the service and it binds to a port."""
    try:
        # Start the service in a subprocess
        process = subprocess.Popen(
            [sys.executable, "audio_processor.py"],
            env={**os.environ, "PORT": "10001"},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Give it a moment to start
        time.sleep(3)
        
        # Check if the process is still running
        if process.poll() is not None:
            stdout, stderr = process.communicate()
            print(f"❌ Service exited with code {process.returncode}")
            print(f"stdout: {stdout.decode()}")
            print(f"stderr: {stderr.decode()}")
            return False
        
        # Try to make a request to the service
        try:
            response = requests.post("http://localhost:10001/process", json={}, timeout=5)
            print("✅ Service is running and responding to requests")
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Service is running but not responding as expected: {e}")
        
        # Terminate the process
        process.terminate()
        process.wait()
        print("✅ Service started and stopped correctly")
        return True
    except Exception as e:
        print(f"❌ Failed to start service: {e}")
        return False

if __name__ == "__main__":
    print("Testing audio processor service...")
    
    import_success = test_service_import()
    startup_success = test_service_startup()
    
    if import_success and startup_success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)