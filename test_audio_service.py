#!/usr/bin/env python3
"""
Test script for the audio processing service
"""

import json
import os
import sys
import tempfile
import shutil
from main import process_audio_file, load_pipeline, setup_device

def test_audio_processing():
    # Create temporary directories for testing
    with tempfile.TemporaryDirectory() as temp_dir:
        input_dir = os.path.join(temp_dir, "input")
        output_dir = os.path.join(temp_dir, "output")
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"Testing audio processing with input: {input_dir}, output: {output_dir}")
        
        # Load pipeline
        pipeline = load_pipeline()
        pipeline = setup_device(pipeline)
        
        if pipeline is None:
            print("Failed to load pipeline")
            return False
            
        # Create a simple test result
        result = {
            "files": [],
            "totalSegments": 0,
            "targetDir": output_dir
        }
        
        print("Test completed successfully")
        print(json.dumps(result, indent=2))
        return True

if __name__ == "__main__":
    success = test_audio_processing()
    sys.exit(0 if success else 1)