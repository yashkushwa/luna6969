import os
import math
import tempfile
import subprocess
import json
from PIL import Image
import shutil
import ffmpeg

# Load configuration
def load_config():
    try:
        with open('config.json', 'r') as f:
            config = json.load(f)
        return config
    except Exception as e:
        print(f"Error loading config.json: {e}")
        print("Using default configuration...")
        return {
            "directories": {
                "videos": "./videos",
                "processed": "./processed"
            },
            "sprites": {
                "thumbnailInterval": 5,
                "thumbnailWidth": 320,
                "thumbnailHeight": 180,
                "thumbnailTimeout": 30
            }
        }

config = load_config()

# Config values
THUMB_INTERVAL = config['sprites']['thumbnailInterval']
THUMB_W = config['sprites']['thumbnailWidth']
THUMB_H = config['sprites']['thumbnailHeight']
THUMB_TIMEOUT = config['sprites']['thumbnailTimeout']

# Format seconds to WEBVTT timecode
def format_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"

# Extract thumbnails at specified times with simple progress logging
def extract_thumbnails(video_path, times):
    tmp = tempfile.mkdtemp()
    files = []
    total = len(times)
    for i, t in enumerate(times):
        out_file = os.path.join(tmp, f"thumb_{i:04d}.jpg")
        cmd = [
            "ffmpeg", "-ss", str(t), "-i", video_path,
            "-vf", f"scale={THUMB_W}:{THUMB_H}",
            "-vframes", "1", "-y", out_file
        ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=THUMB_TIMEOUT)
            files.append(out_file)
        except Exception:
            pass
        print(f"Processed {i+1}/{total} sprite images")
    return tmp, files

# Build sprite image
def build_sprite(thumbnail_files, sprite_path):
    n = len(thumbnail_files)
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    sprite = Image.new('RGB', (cols * THUMB_W, rows * THUMB_H))
    for idx, fp in enumerate(thumbnail_files):
        img = Image.open(fp)
        row, col = divmod(idx, cols)
        sprite.paste(img, (col * THUMB_W, row * THUMB_H))
    sprite.save(sprite_path, optimize=True)

# Write VTT file
def write_vtt(sprite_url, times, vtt_path):
    n = len(times)
    cols = math.ceil(math.sqrt(n))
    with open(vtt_path, 'w') as f:
        f.write("WEBVTT\n\n")
        for i, t in enumerate(times):
            start = format_time(t)
            end = format_time(t + THUMB_INTERVAL)
            row, col = divmod(i, cols)
            x = col * THUMB_W
            y = row * THUMB_H
            f.write(f"{start} --> {end}\n")
            f.write(f"{sprite_url}#xywh={x},{y},{THUMB_W},{THUMB_H}\n\n")

# Orchestrate sprite creation from a single video
def sprite_from_video(video_path, output_dir):
    duration = float(ffmpeg.probe(video_path)['format']['duration'])
    times = list(range(0, int(duration), THUMB_INTERVAL))
    if not times or times[-1] < duration - THUMB_INTERVAL:
        times.append(int(duration - THUMB_INTERVAL))

    tmpdir, thumbs = extract_thumbnails(video_path, times)

    basename = os.path.splitext(os.path.basename(video_path))[0]
    sprite_f = os.path.join(output_dir, f"{basename}.png")
    build_sprite(thumbs, sprite_f)

    vtt_f = os.path.join(output_dir, f"{basename}.vtt")
    sprite_url = f"/processed/{basename}.png"
    write_vtt(sprite_url, times, vtt_f)

    shutil.rmtree(tmpdir)
    return sprite_f, vtt_f

if __name__ == "__main__":
    import sys
    PROCESSED_DIR = config['directories']['processed']
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        if not os.path.exists(video_path):
            print(f"Error: Video file not found: {video_path}")
            sys.exit(1)
        sprite_from_video(video_path, PROCESSED_DIR)
    else:
        videos_dir = config['directories']['videos']
        for filename in os.listdir(videos_dir):
            if not filename.lower().endswith((".mp4", ".mov", ".avi", ".mkv")):
                continue
            path = os.path.join(videos_dir, filename)
            sprite_from_video(path, PROCESSED_DIR)
