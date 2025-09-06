# Python Audio Processing Service

This service handles the audio processing using pyannote.audio for speaker diarization.

## Deployment

1. Create a new service on Render/Railway/AWS Lambda
2. Set the following environment variables:
   - PORT (optional, defaults to 8000)

3. Use the following build command:
   ```bash
   python3.9 -m venv venv && . venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt
   ```

4. Use the following start command:
   ```bash
   . venv/bin/activate && python audio_processor.py
   ```

## API

POST /process
{
  "audio_src_dir": "/path/to/audio/files",
  "target_root_dir": "/path/to/output"
}

Response:
{
  "files": [...],
  "totalSegments": 0,
  "targetDir": "/path/to/output"
}