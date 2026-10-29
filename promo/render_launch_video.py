import http.server
import socketserver
import threading
import time
import os
import subprocess
import glob
from playwright.sync_api import sync_playwright

PORT = 9911
PROMO_DIR = r"r:\IntergalacticTV\promo"
BUILD_DIR = os.path.join(PROMO_DIR, "build")
OUTPUT_MP4 = os.path.join(PROMO_DIR, "YouTube-AI-Motion-Graphics-Launch.mp4")

os.makedirs(BUILD_DIR, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROMO_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()
time.sleep(1)

print("Promo server running on port", PORT)

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

    print("Starting video recording in Playwright...")
    context = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        device_scale_factor=1,
        record_video_dir=BUILD_DIR,
        record_video_size={"width": 1920, "height": 1080}
    )

    page = context.new_page()
    page.goto(f"http://localhost:{PORT}/motion-graphics-launch.html")

    # Let the launch video play in full (36 seconds)
    print("Recording motion graphics presentation (36s)...")
    time.sleep(36.5)

    context.close()
    browser.close()

print("Browser session closed. Finding recorded video...")
video_files = glob.glob(os.path.join(BUILD_DIR, "*.webm"))
if not video_files:
    raise RuntimeError("No recorded video found in build directory.")

latest_webm = max(video_files, key=os.path.getmtime)
print(f"Recorded video: {latest_webm}")

# Convert to broadcast H.264 MP4 with FFmpeg
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
