import os
import sys
import json
from pyannote.audio import Pipeline
from pydub import AudioSegment
import torch

# Use the old torch.load behavior (weights_only=False) for compatibility
import warnings
warnings.filterwarnings("ignore", message=".*weights_only.*")

# Set your Hugging Face token here (still needed for some components)
# You can set this via environment variable HF_TOKEN or update it here directly
AUTH_TOKEN = os.environ.get("HF_TOKEN", "")

# Redirect all print statements to stderr except for the final JSON output
class StdoutRedirect:
    def __init__(self):
        self.stdout = sys.stdout
        self.stderr = sys.stderr
    
    def write(self, text):
        self.stderr.write(text)
    
    def flush(self):
        self.stderr.flush()

# Create an instance of the redirector
stdout_redirector = StdoutRedirect()

# INPUTS: passed as command line arguments
if len(sys.argv) != 3:
    print("Usage: python main.py <audio_source_directory> <target_directory>")
    sys.exit(1)

audio_src_dir = sys.argv[1]
target_root_dir = sys.argv[2]

# Validate inputs
if not os.path.isdir(audio_src_dir):
    raise FileNotFoundError(f"Source audio directory not found: {audio_src_dir}")

os.makedirs(target_root_dir, exist_ok=True)

# Supported audio file extensions
SUPPORTED_EXTS = (".wav", ".mp3", ".flac", ".m4a", ".aac")

def iter_audio_files(root_dir, exts=SUPPORTED_EXTS):
    """Iterate through audio files recursively in a directory."""
    for dirpath, _, files in os.walk(root_dir):
        for name in files:
            if name.lower().endswith(tuple(ext.lower() for ext in exts)):
                yield os.path.join(dirpath, name)

def load_pipeline():
    """Load the speaker diarization pipeline with fallback to online mode."""
    print("🔽 Loading pipeline from cache...", file=stdout_redirector)
    
    # Set environment variable to use offline mode
    os.environ['HF_HUB_OFFLINE'] = '1'
    
    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=AUTH_TOKEN
        )
        print("✅ Pipeline loaded successfully from cache!", file=stdout_redirector)
        return pipeline
    except Exception as e:
        print(f"❌ Failed to load pipeline from cache: {e}", file=stdout_redirector)
        print("🔄 Trying online mode...", file=stdout_redirector)
        
        # Try online mode if offline fails
        os.environ.pop('HF_HUB_OFFLINE', None)
        try:
            pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=AUTH_TOKEN
            )
            print("✅ Pipeline loaded successfully online!", file=stdout_redirector)
            return pipeline
        except Exception as e2:
            print(f"❌ Failed to load pipeline online: {e2}", file=stdout_redirector)
            print("\nPlease ensure:", file=stdout_redirector)
            print("1. Your Hugging Face token is valid: https://hf.co/settings/tokens", file=stdout_redirector)
            print("2. You've accepted the model conditions: https://hf.co/pyannote/speaker-diarization-3.1", file=stdout_redirector)
            print("3. You have internet connection for initial download", file=stdout_redirector)
            return None

def setup_device(pipeline):
    """Set up the device for the pipeline (MPS for Apple Silicon or CPU)."""
    if pipeline is None:
        return pipeline
    
    try:
        if torch.backends.mps.is_available():
            print("📱 Moving pipeline to MPS device...", file=stdout_redirector)
            pipeline.to(torch.device("mps"))
            print("✅ Pipeline moved to MPS device!", file=stdout_redirector)
        else:
            print("⚠️ MPS not available. Using CPU.", file=stdout_redirector)
    except Exception as e:
        print(f"⚠️ Could not move pipeline to MPS: {e}. Using CPU.", file=stdout_redirector)
    
    return pipeline

def process_audio_file(audio_path, pipeline, target_root_dir):
    """Process a single audio file for speaker diarization."""
    base = os.path.splitext(os.path.basename(audio_path))[0]
    out_dir = os.path.join(target_root_dir, base)
    os.makedirs(out_dir, exist_ok=True)
    
    # Copy the original file to the output directory
    original_output_path = os.path.join(target_root_dir, os.path.basename(audio_path))
    try:
        import shutil
        shutil.copy2(audio_path, original_output_path)
        print(f"📁 Original file copied to: {original_output_path}", file=stdout_redirector)
    except Exception as e:
        print(f"⚠️ Failed to copy original file: {e}", file=stdout_redirector)
    
    print("\n" + "-" * 70, file=stdout_redirector)
    print(f"▶️ File: {audio_path}", file=stdout_redirector)
    print(f"📁 Clips folder: {out_dir}", file=stdout_redirector)
    
    file_segments = []
    
    try:
        diarization = pipeline(audio_path)
    except Exception as e:
        print(f"❌ Diarization failed for {audio_path}: {e}", file=stdout_redirector)
        return {
            "id": base,
            "name": base,
            "segments": [],
            "status": "error",
            "progress": 0
        }
    
    try:
        audio = AudioSegment.from_file(audio_path)
    except Exception as e:
        print(f"❌ Failed to load audio with pydub for {audio_path}: {e}", file=stdout_redirector)
        return {
            "id": base,
            "name": base,
            "segments": [],
            "status": "error",
            "progress": 0
        }
    
    print("👥 Speaker Segments:", file=stdout_redirector)
    clip_count = 0
    for i, (turn, _, speaker) in enumerate(diarization.itertracks(yield_label=True)):
        clip_count += 1
        print(f"  🎯 {clip_count:2d}: {turn.start:.1f}s-{turn.end:.1f}s | Speaker {speaker}", file=stdout_redirector)
        
        start_ms = int(turn.start * 1000)
        end_ms = int(turn.end * 1000)
        clip = audio[start_ms:end_ms]
        
        # Save as WAV file inside the per-audio folder
        safe_speaker = str(speaker).replace(os.sep, "-")
        filename = os.path.join(
            out_dir,
            f"clip_{clip_count:03d}_speaker_{safe_speaker}_{turn.start:.1f}s-{turn.end:.1f}s.wav",
        )
        
        try:
            clip.export(filename, format="wav")
            print(f"     💾 Saved: {filename}", file=stdout_redirector)
            
            # Add segment to results
            file_segments.append({
                "id": f"{base}_segment_{clip_count}",
                "speaker": str(speaker),
                "startTime": float(turn.start),
                "endTime": float(turn.end),
                "duration": float(turn.end - turn.start),
                "audioUrl": f"/api/audio/{base}/{os.path.basename(filename)}"
            })
            
        except Exception as e:
            print(f"     ❌ Failed to save clip: {e}", file=stdout_redirector)
    
    print(f"✅ Processed {clip_count} segments for {base}", file=stdout_redirector)
    return {
        "id": base,
        "name": base,
        "segments": file_segments,
        "status": "Completed",
        "progress": 100
    }

def main():
    """Main function to run speaker diarization on audio files."""
    # Redirect stdout to stderr for all messages except final JSON
    sys.stdout = stdout_redirector
    
    # Print non-JSON messages to stderr so they don't interfere with JSON parsing
    print("🎤 Running speaker diarization on directory:")
    print(f"   📂 Source: {audio_src_dir}")
    print(f"   📁 Target: {target_root_dir}")
    
    # Load pipeline
    pipeline = load_pipeline()
    pipeline = setup_device(pipeline)
    
    # Only proceed if pipeline loaded successfully
    if pipeline is None:
        print("❌ Cannot proceed without a valid pipeline. Please fix the authentication issue first.")
        result = {
            "files": [],
            "totalSegments": 0,
            "targetDir": target_root_dir,
            "error": "Failed to load pipeline"
        }
        # Switch back to real stdout just for the JSON output
        sys.stdout = stdout_redirector.stdout
        print(json.dumps(result))
        return
    
    # Process files
    processed_files = []
    total_segments = 0
    
    for audio_path in iter_audio_files(audio_src_dir, exts=(".wav",)):
        result = process_audio_file(audio_path, pipeline, target_root_dir)
        processed_files.append(result)
        total_segments += len(result["segments"])
    
    print("\n" + "=" * 70)
    print(f"🏁 Done. Files processed: {len(processed_files)} | Total segments: {total_segments}")
    print(f"📦 Output root: {target_root_dir}")
    
    # Output results as JSON (only JSON to stdout)
    result = {
        "files": processed_files,
        "totalSegments": total_segments,
        "targetDir": target_root_dir
    }
    
    # Switch back to real stdout just for the JSON output
    sys.stdout = stdout_redirector.stdout
    # Print only the JSON to stdout (no indent to avoid extra whitespace)
    print(json.dumps(result))

if __name__ == "__main__":
    main()