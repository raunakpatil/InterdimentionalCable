import http.server
import socketserver
import threading
import time
import os
import subprocess
import glob
from playwright.sync_api import sync_playwright

PORT = 9933
REPO_ROOT = r"r:\IntergalacticTV"
PROMO_DIR = os.path.join(REPO_ROOT, "promo")
BUILD_DIR = os.path.join(PROMO_DIR, "build")
OUTPUT_MP4 = os.path.join(PROMO_DIR, "InterDimentional-Cable-TV-Launch.mp4")

os.makedirs(BUILD_DIR, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_ROOT, **kwargs)

    def guess_type(self, path):
        if path.endswith(".glb"):
            return "model/gltf-binary"
        if path.endswith(".webp"):
            return "image/webp"
        return super().guess_type(path)

    def log_message(self, format, *args):
        pass

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()
time.sleep(1)

print("Server running on port", PORT)

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        headless=True,
        args=[
            "--use-gl=angle",
            "--use-angle=d3d11",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--autoplay-policy=no-user-gesture-required"
        ]
    )

    print("Recording InterDimentional Cable TV Motion Graphics...")
    context = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        device_scale_factor=1,
        record_video_dir=BUILD_DIR,
        record_video_size={"width": 1920, "height": 1080}
    )

    page = context.new_page()
    page.goto(f"http://localhost:{PORT}/promo/motion-graphics-launch.html")

    # Record 36.5 seconds of motion graphics presentation
    print("Recording 36 seconds...")
    time.sleep(36.5)

    context.close()
    browser.close()

print("Browser session closed. Finding recorded source...")
video_files = glob.glob(os.path.join(BUILD_DIR, "*.webm"))
if not video_files:
    raise RuntimeError("No recorded video found in build directory.")

latest_webm = max(video_files, key=os.path.getmtime)
print(f"Recorded source: {latest_webm}")

# Transcode with FFmpeg to crisp 1080p 60fps H.264 MP4
print(f"Transcoding to {OUTPUT_MP4} via FFmpeg...")
ffmpeg_cmd = [
    "ffmpeg",
    "-y",
    "-i", latest_webm,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", "60",
    OUTPUT_MP4
]

res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
if res.returncode != 0:
    print("FFmpeg Error:", res.stderr)
    raise RuntimeError("FFmpeg transcode failed.")

file_size_mb = os.path.getsize(OUTPUT_MP4) / (1024 * 1024)
print(f"Success! Generated {OUTPUT_MP4} ({file_size_mb:.2f} MB)")

# Also generate fresh high-res thumbnail
thumb_path = os.path.join(PROMO_DIR, "launch-thumbnail.png")
subprocess.run([
    "ffmpeg", "-y",
    "-ss", "00:00:15",
    "-i", OUTPUT_MP4,
    "-vframes", "1",
    thumb_path
], capture_output=True)
print(f"Updated thumbnail: {thumb_path}")
