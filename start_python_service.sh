#!/bin/bash
# Start the Python audio processing service

# Activate virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Start the Python service
python audio_processor.py