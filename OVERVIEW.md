# Luna6969 Video Server - Application Overview

## Introduction
This application is a Node.js-based video server that automatically generates thumbnails and sprite previews and provides a minimal user interface for browsing and playing videos.

## Directory Structure
- **config.json**: Application configuration
- **server.js**: Main Express server entry point
- **public/**: Frontend static files
  - **index.html**: Frontend page for browsing and managing videos
  - **videoplayer.html**: Frontend page for playing videos with previews
- **routes/**: API route definitions
  - **videoRoutes.js**: Routes for video-related operations
- **controllers/**: Business logic
  - **videoController.js**: Video management functionality
- **utils/**: Helper utilities
  - **logger.js**: Custom console logger
  - **thumbnailGenerator.js**: Module to ensure and generate thumbnails using ffmpeg
- **scripts/**: External scripts
  - **spritepreview.py**: Python script to generate sprite sheets and VTT files for hover previews
- **package.json** & **package-lock.json**: Node.js dependencies

## Media Directories
The application uses the following directories for media storage (configured in config.json):
- **videos/**: Directory containing raw `.mp4` video files
- **thumbnails/**: Directory containing generated thumbnail images
- **processed/**: Directory containing sprite sheets (`.png`) and VTT files

## Configuration (`config.json`)
```json
{
  "directories": {
    "videos": "<path>",
    "thumbnails": "<path>",
    "processed": "<path>"
  },
  "server": { "port": 3000 },
  "thumbnails": { "defaultThumbnailTime": "00:00:01", "quality": 2, "width": 320, "height": 180 },
  "sprites": { "spriteInterval": 5, "spriteWidth": 320, "spriteHeight": 180, "spriteTimeout": 50, "spriteWorkers": 20 }
}
```

## Dependencies
- **express** (`^5.1.0`)
- **fluent-ffmpeg** (`^2.1.2`)

## Core Components

### Server (`server.js`)
- Initializes Express application
- Mounts static directories for media files
- Registers API routes
- Handles configuration loading

### Routes (`routes/videoRoutes.js`)
Defines all API endpoints:
- `GET /api/videos` - Retrieves video metadata
- `POST /api/refresh-thumbnail/:id` - Regenerates thumbnail
- `POST /api/generate-sprite/:id` - Creates sprite sheet and VTT
- `POST /api/rename-video/:id` - Renames video files
- `DELETE /api/delete-video/:id` - Deletes video and related files

### Controllers (`controllers/videoController.js`)
Implements all business logic:
- Video metadata extraction
- Thumbnail generation
- Sprite generation via Python script
- File operations (rename, delete)

### Utilities

#### Logging (`utils/logger.js`)
Provides a colored, timestamped console logging system by patching global `console` methods.

#### Thumbnail Generation (`utils/thumbnailGenerator.js`)
- **ensureThumbnails()**: Scans `videos/` for `.mp4` files and generates missing `.jpg` thumbnails.
- **generateThumbnail(videoPath, thumbnailPath)**: Generates a single thumbnail at a random timestamp or default time.

### Scripts

#### Sprite Preview Generation (`scripts/spritepreview.py`)
A Python utility that:
1. Reads sprite settings from `config.json`.
2. Extracts frames at intervals using ffmpeg.
3. Builds a sprite sheet image (`.png`) and VTT file for seekbar hover previews.
4. Cleans up temporary files.

## Frontend UI

### index.html
- Fetches video list from `/api/videos`.
- Renders each video with:
  - Thumbnail preview.
  - Title.
  - Action buttons: Play, Refresh Thumbnail, Generate Sprite, Rename.

### videoplayer.html
- Uses [Plyr](https://github.com/sampotts/plyr) for a modern HTML5 video player.
- Reads `id` query parameter to load the correct video.
- Appends an HTML `<track>` for VTT-based hover previews if available.
- Configs: controls (play, progress, volume, settings, fullscreen), tooltips, previewThumbnails.

## API Endpoints

### GET `/api/videos`
Returns an array of video objects with:
- `id`: Numeric identifier
- `title`: Filename without extension
- `duration`: Video length in mm:ss format
- `size`: File size in MB
- `date`: Creation date of the file
- `thumbnail`: URL to the thumbnail image (with cache-busting)
- `vtt`: URL to VTT file (if available)
- `url`: URL to the video file

### POST `/api/refresh-thumbnail/:id`
Regenerates the thumbnail for the specified video.

### POST `/api/generate-sprite/:id`
Generates sprite sheet and VTT file for video seek preview.

### POST `/api/rename-video/:id`
Renames the video and all associated files.

### DELETE `/api/delete-video/:id`
Deletes the video and all associated files.

## Usage
1. `npm install` to install dependencies.
2. Place your `.mp4` videos in the configured `videos/` directory.
3. Run `npm start` (or `node server.js`).
4. Open `http://localhost:3000/` to browse, manage, and play videos.

## Extending the App
- Adjust thumbnail and sprite parameters in `config.json`.
- Enhance UI/UX in `public/index.html` and `public/videoplayer.html`.
- Add authentication, metadata storage, or support for more formats as needed.

--- 