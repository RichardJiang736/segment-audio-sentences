from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import sys
import urllib.parse
from main import process_audio_file, load_pipeline, setup_device

# Load the pipeline once when the server starts
pipeline = load_pipeline()
pipeline = setup_device(pipeline)

class AudioProcessorHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/process':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Parse JSON data
                data = json.loads(post_data.decode('utf-8'))
                audio_src_dir = data.get('audio_src_dir')
                target_root_dir = data.get('target_root_dir')
                
                if not audio_src_dir or not target_root_dir:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {'error': 'Missing audio_src_dir or target_root_dir'}
                    self.wfile.write(json.dumps(response).encode())
                    return
                
                # Process the audio files
                result = {
                    "files": [],
                    "totalSegments": 0,
                    "targetDir": target_root_dir
                }
                
                if pipeline is not None:
                    for filename in os.listdir(audio_src_dir):
                        if filename.endswith(('.wav', '.mp3', '.flac', '.m4a', '.aac')):
                            audio_path = os.path.join(audio_src_dir, filename)
                            file_result = process_audio_file(audio_path, pipeline, target_root_dir)
                            result["files"].append(file_result)
                            result["totalSegments"] += len(file_result["segments"])
                
                # Send response
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {'error': str(e)}
                self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, AudioProcessorHandler)
    print(f"Audio processor server running on port {port}")
    httpd.serve_forever()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    run_server(port)