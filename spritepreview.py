import os
import math
import tempfile
import shutil
import subprocess
import json
import re
import time
from concurrent.futures import ProcessPoolExecutor, as_completed, ThreadPoolExecutor
from PIL import Image
import ffmpeg

# Load configuration
def load_config():
    try:
        with open('config.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading config.json: {e}\nUsing default configuration...", flush=True)
        return {
            "directories": {"videos": "./videos", "processed": "./processed"},
            "sprites": {"spriteInterval": 5, "spriteWidth": 320, "spriteHeight": 180, "spriteTimeout": 30}
        }

config = load_config()
SPRITE_INTERVAL = config['sprites']['spriteInterval']
SPRITE_W = config['sprites']['spriteWidth']
SPRITE_H = config['sprites']['spriteHeight']
SPRITE_TIMEOUT = config['sprites']['spriteTimeout']
# Number of parallel workers for thumbnail extraction (default: CPU cores)
WORKERS = config['sprites'].get('spriteWorkers', os.cpu_count())

# Sanitize filenames to avoid issues with special characters
def sanitize_filename(filename):
    # Remove file extension
    base_name = os.path.splitext(filename)[0]
    # Replace problematic characters with underscores
    sanitized = re.sub(r'[\\/*?:"<>|]', '_', base_name)
    # Limit length to avoid path issues
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    return sanitized

# Format seconds to WEBVTT timecode
def format_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"

def _extract_single_thumbnail(args):
    video_path, t, out_file = args
    cmd = [
        'ffmpeg',
        '-hide_banner', '-loglevel', 'error',  # suppress ffmpeg noise
        '-ss', str(t), '-i', video_path,
        '-vf', f'scale={SPRITE_W}:{SPRITE_H}',
        '-vframes', '1',
        '-y', out_file
    ]
    # Silence ffmpeg output completely; we only care about our own progress logs
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    proc.wait(timeout=SPRITE_TIMEOUT)
    return out_file

def extract_sprite_frames(video_path, times):
    tmp = tempfile.mkdtemp()
    total = len(times)
    args_list = [(video_path, t, os.path.join(tmp, f"thumb_{i:04d}.jpg")) for i, t in enumerate(times)]
    files = [arg[2] for arg in args_list]
    results = [None] * total
    completed = 0
    print(f"Extracting {total} sprite frames from {os.path.basename(video_path)}...")
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        future_to_idx = {executor.submit(_extract_single_thumbnail, arg): idx for idx, arg in enumerate(args_list)}
        for fut in as_completed(future_to_idx):
            idx = future_to_idx[fut]
            fut.result()
            results[idx] = True
            completed += 1
            # Update same console line with carriage return
            print(f"\rProcessing sprite frames: {completed}/{total}", end='', flush=True)

    print()  # newline after progress loop
    return tmp, files

# Build sprite image from extracted thumbnails
def build_sprite(thumbnail_files, sprite_path):
    n = len(thumbnail_files)
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    sprite = Image.new('RGB', (cols * SPRITE_W, rows * SPRITE_H))
    print(f"Building sprite sheet: {n} thumbnails, {cols} cols x {rows} rows")
    for idx, fp in enumerate(thumbnail_files):
        img = Image.open(fp)
        row, col = divmod(idx, cols)
        sprite.paste(img, (col * SPRITE_W, row * SPRITE_H))
        # Update same console line with carriage return
        print(f"\rBuilding sprite sheet: {idx+1}/{n}", end='', flush=True)
    print()  # newline after sprite build loop
    print(f"Saving sprite image to {sprite_path}", flush=True)
    sprite.save(sprite_path, optimize=True)
    print(f"Sprite saved as {sprite_path}", flush=True)

# Write VTT file pointing to regions in the sprite
def write_vtt(sprite_url, times, vtt_path):
    n = len(times)
    cols = math.ceil(math.sqrt(n))
    print(f"Creating VTT file at {vtt_path}", flush=True)
    with open(vtt_path, 'w') as f:
        f.write("WEBVTT\n\n")
        for i, t in enumerate(times):
            start = format_time(t)
            end = format_time(t + SPRITE_INTERVAL)
            row, col = divmod(i, cols)
            x, y = col * SPRITE_W, row * SPRITE_H
            f.write(f"{start} --> {end}\n")
            f.write(f"{sprite_url}#xywh={x},{y},{SPRITE_W},{SPRITE_H}\n\n")
    print(f"VTT file saved as {vtt_path}", flush=True)

# Create sprite and VTT for a single video
def sprite_from_video(video_path, output_dir):
    print(f"Probing video file {video_path}", flush=True)
    
    # Sanitize the filename for output
    original_basename = os.path.splitext(os.path.basename(video_path))[0]
    sanitized_basename = sanitize_filename(original_basename)
    
    # Check if files already exist
    sprite_file = os.path.join(output_dir, f"{sanitized_basename}.png")
    vtt_file = os.path.join(output_dir, f"{sanitized_basename}.vtt")
    
    if os.path.exists(sprite_file) and os.path.exists(vtt_file):
        print(f"Sprite and VTT already exist for {original_basename}, skipping...", flush=True)
        return sprite_file, vtt_file
    
    try:
        # Get video duration
        probe_result = ffmpeg.probe(video_path)
        duration = float(probe_result['format']['duration'])
        
        # Calculate frame times
        times = list(range(0, int(duration), SPRITE_INTERVAL))
        if not times or times[-1] < duration - SPRITE_INTERVAL:
            times.append(int(duration - SPRITE_INTERVAL))

        # Extract frames
        tmpdir, thumbs = extract_sprite_frames(video_path, times)
        
        # Build sprite image
        build_sprite(thumbs, sprite_file)

        # Create VTT file
        sprite_url = f"/processed/{sanitized_basename}.png"
        write_vtt(sprite_url, times, vtt_file)

        # Cleanup
        print(f"Cleaning up temporary files", flush=True)
        shutil.rmtree(tmpdir)
        print(f"Processing of {original_basename} completed successfully", flush=True)
        return sprite_file, vtt_file
        
    except ffmpeg.Error as e:
        print(f"FFmpeg error processing {video_path}: {e.stderr.decode() if e.stderr else str(e)}", flush=True)
        raise
    except Exception as e:
        print(f"Error processing {video_path}: {str(e)}", flush=True)
        raise

if __name__ == '__main__':
    import sys
    import time
    
    start_time = time.time()
    videos_dir = config['directories']['videos']
    processed_dir = config['directories']['processed']
    os.makedirs(processed_dir, exist_ok=True)

    # Collect video files
    if len(sys.argv) > 1:
        video_paths = [sys.argv[1]]
        print(f"Processing single video: {sys.argv[1]}", flush=True)
    else:
        print(f"Scanning directory: {videos_dir}", flush=True)
        video_files = [f for f in os.listdir(videos_dir) 
                      if f.lower().endswith(('.mp4', '.mov', '.avi', '.mkv'))]
        video_paths = [os.path.join(videos_dir, f) for f in video_files]
        print(f"Found {len(video_paths)} video files to process", flush=True)
    
    if not video_paths:
        print("No video files found to process!", flush=True)
        sys.exit(0)
        
    # Process videos sequentially for real-time logging
    successful = []
    failed = []
    skipped = []
    
    for i, vid in enumerate(video_paths):
        print(f"\n[{i+1}/{len(video_paths)}] Processing: {os.path.basename(vid)}", flush=True)
        try:
            # Check if output files already exist
            basename = sanitize_filename(os.path.splitext(os.path.basename(vid))[0])
            sprite_file = os.path.join(processed_dir, f"{basename}.png")
            vtt_file = os.path.join(processed_dir, f"{basename}.vtt")
            
            if os.path.exists(sprite_file) and os.path.exists(vtt_file):
                print(f"Files already exist for {os.path.basename(vid)}, skipping...", flush=True)
                skipped.append(vid)
                continue
                
            # Process the video
            sprite, vtt = sprite_from_video(vid, processed_dir)
            successful.append(vid)
            print(f"Completed: {os.path.basename(vid)} -> {os.path.basename(sprite)}, {os.path.basename(vtt)}", flush=True)
        except KeyboardInterrupt:
            print("\nProcess interrupted by user. Exiting...", flush=True)
            sys.exit(1)
        except Exception as e:
            print(f"Error processing {vid}: {e}", flush=True)
            failed.append(vid)
    
    # Print summary
    elapsed_time = time.time() - start_time
    print("\n" + "="*50)
    print(f"SPRITE GENERATION SUMMARY")
    print(f"Total processing time: {elapsed_time:.2f} seconds")
    print(f"Videos processed: {len(video_paths)}")
    print(f"  - Successful: {len(successful)}")
    print(f"  - Skipped (already exist): {len(skipped)}")
    print(f"  - Failed: {len(failed)}")
    
    if failed:
        print("\nFailed videos:")
        for vid in failed:
            print(f"  - {os.path.basename(vid)}")
    print("="*50)
