# Luna6969 Video Server v2.0 - Application Overview

## Introduction
Luna6969 Video Server v2.0 is a production-ready, advanced Node.js-based video management and streaming server. It features modern architecture with service layer pattern, comprehensive security, performance optimizations, and a rich user interface for video browsing and management.

## ⚡ What's New in v2.0
- **🏗️ Modern Architecture**: Service layer pattern with proper separation of concerns
- **🚀 Performance**: Multi-tier caching system, HTTP cache headers, compression
- **🔒 Security**: CORS, rate limiting, input validation, security headers (Helmet)
- **📊 API Improvements**: Pagination, search, filtering, comprehensive error handling
- **🎛️ Advanced Configuration**: Hot-reload config management, environment variables
- **📈 Monitoring**: Health checks, statistics dashboard, structured logging
- **🛠️ Developer Experience**: Better error messages, validation middleware, async/await patterns

## 📁 Directory Structure
```
├── config.json                    # Application configuration
├── server.js                      # Main server with class-based architecture
├── package.json                   # Dependencies and scripts
├── .env.example                   # Environment variables example
├── .gitignore                     # Git ignore rules
├── controllers/                   # Request handlers
│   └── videoController.js         # Video API endpoints
├── services/                      # Business logic layer
│   ├── videoService.js           # Video operations and metadata
│   └── thumbnailService.js       # Thumbnail generation and management
├── middleware/                   # Express middleware
│   ├── errorHandler.js           # Error handling and async wrapper
│   ├── security.js               # Security middleware (CORS, rate limiting, etc.)
│   └── validation.js             # Request validation using Joi
├── utils/                        # Utilities and helpers
│   ├── configManager.js          # Centralized configuration with hot-reload
│   ├── cache.js                  # Multi-tier caching system
│   ├── logger.js                 # Enhanced logging with file output
│   └── thumbnailGenerator.js     # Legacy wrapper (deprecated)
├── routes/                       # API route definitions
│   └── videoRoutes.js            # RESTful video routes with validation
├── public/                       # Frontend application
│   ├── index.html                # Modern video management interface
│   └── videoplayer.html          # Enhanced video player with previews
├── scripts/                      # External utilities
│   └── spritepreview.py          # Sprite sheet generation
├── videos/                       # Video files directory
├── thumbnails/                   # Generated thumbnails
└── processed/                    # Sprite sheets and VTT files
```

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

## 📦 Dependencies

### Core Dependencies
- **express** (`^4.18.2`) - Web framework
- **fluent-ffmpeg** (`^2.1.2`) - FFmpeg wrapper for video processing

### Security & Performance
- **helmet** (`^7.0.0`) - Security headers
- **cors** (`^2.8.5`) - Cross-origin resource sharing
- **express-rate-limit** (`^6.7.0`) - Rate limiting
- **compression** (`^1.7.4`) - Response compression
- **node-cache** (`^5.1.2`) - In-memory caching

### Validation & Error Handling
- **joi** (`^17.9.2`) - Input validation
- **express-async-handler** (`^1.2.0`) - Async error handling

### Logging & Monitoring
- **morgan** (`^1.10.0`) - HTTP request logging

### Development
- **nodemon** (`^3.0.1`) - Development server with auto-reload

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Logging
LOG_LEVEL=INFO
LOG_TO_FILE=false
LOG_FILE=./logs/app.log

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
CORS_ORIGIN=*

# Performance
COMPRESSION_LEVEL=6
REQUEST_TIMEOUT=30000
```

### Configuration File (config.json)
The application supports hot-reload configuration with comprehensive defaults:
```json
{
  "directories": {
    "videos": "./videos",
    "thumbnails": "./thumbnails", 
    "processed": "./processed"
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "cache": {
    "videoMetadata": 300,
    "thumbnails": 3600,
    "sprites": 7200
  },
  "security": {
    "rateLimit": { "windowMs": 900000, "max": 100 },
    "cors": { "origin": true, "credentials": true }
  }
}
```

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

## 🔌 API Endpoints

### Core Endpoints

#### `GET /api/videos`
**Enhanced video listing with pagination, search, and sorting**
- **Query Parameters:**
  - `page` (default: 1): Page number
  - `limit` (default: 20, max: 100): Items per page
  - `search`: Search query (min 2 chars)
  - `sort` (default: 'title'): Sort by title, date, size, duration
  - `order` (default: 'asc'): Sort order (asc/desc)
- **Response:**
  ```json
  {
    "videos": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8,
      "hasNext": true,
      "hasPrev": false
    },
    "search": "query",
    "sort": "title",
    "order": "asc"
  }
  ```

#### `GET /api/stats`
**System and video statistics**
- Returns comprehensive stats about videos, thumbnails, sprites, cache, and system resources

#### `GET /api/health`
**Health check and system information**
- Server status, version, uptime, memory usage, cache statistics

### Video Operations

#### `POST /api/refresh-thumbnail/:id`
**Regenerate thumbnail for specific video**
- Validates video ID
- Returns new thumbnail URL with cache-busting

#### `POST /api/generate-sprite/:id`
**Generate sprite sheet and VTT file for video seek preview**
- Creates hover preview thumbnails
- Generates WebVTT file for Plyr integration

#### `POST /api/rename-video/:id`
**Rename video and all associated files**
- **Body:** `{ "newName": "New Video Name" }`
- Validates filename safety
- Updates all related files (thumbnail, sprite, VTT)

#### `DELETE /api/delete-video/:id`
**Delete video and all associated files**
- Removes video, thumbnail, sprite sheet, and VTT file
- Returns confirmation message

#### `POST /api/cleanup`
**Clean up orphaned files**
- Removes thumbnails and processed files without corresponding videos
- Returns count of deleted files

### Response Headers
- `X-Total-Count`: Total number of items
- `X-Page-Count`: Total number of pages
- `X-Current-Page`: Current page number
- `X-Per-Page`: Items per page

## 🚀 Getting Started

### Installation
```bash
# Clone or extract the project
cd luna6969-video-server

# Install dependencies
npm install

# Create required directories
mkdir -p videos thumbnails processed

# Copy environment file (optional)
cp .env.example .env

# Start the server
npm start
```

### Development Mode
```bash
# Install nodemon for auto-reload
npm install -g nodemon

# Start in development mode
npm run dev
```

### Usage
1. Place your video files (`.mp4`, `.webm`, `.mov`, `.mkv`) in the `videos/` directory
2. Open `http://localhost:3000/` in your browser
3. The server will automatically generate thumbnails on first access
4. Use the web interface to manage videos, or interact with the REST API directly

## 🛠️ Advanced Features

### Caching System
- **Multi-tier caching** with different TTL values for different content types
- **Smart cache invalidation** when files are modified
- **Memory-efficient** with configurable limits
- **Cache statistics** available through health endpoint

### Security Features
- **Rate limiting** to prevent abuse
- **CORS** configuration for cross-origin requests  
- **Input validation** using Joi schemas
- **Security headers** via Helmet
- **Path traversal protection**
- **File type validation**

### Performance Optimizations  
- **HTTP compression** with gzip
- **Static file caching** with appropriate cache headers
- **Lazy loading** and pagination for large video libraries
- **Async/await patterns** for non-blocking operations
- **Batch thumbnail processing** with progress tracking

### Monitoring & Observability
- **Health checks** at `/health` and `/api/health`
- **Comprehensive statistics** at `/api/stats`
- **Structured logging** with optional file output
- **Request/response logging** with performance metrics
- **Cache hit/miss statistics**

## 🔧 Extending the Application

### Adding New Video Formats
Edit `services/videoService.js` and update the `supportedFormats` array:
```javascript
this.supportedFormats = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.flv', '.m4v'];
```

### Custom Thumbnail Settings
Update `config.json`:
```json
{
  "thumbnails": {
    "defaultThumbnailTime": "00:00:05",
    "quality": 3,
    "width": 640,
    "height": 360
  }
}
```

### Adding Authentication
1. Install authentication middleware (e.g., `passport`, `express-session`)
2. Add auth middleware before routes in `server.js`
3. Update frontend to handle authentication

### Database Integration
1. Install database driver (e.g., `mongoose`, `sequelize`)
2. Create models in `models/` directory
3. Update services to use database instead of file scanning

### API Rate Limiting Customization
Update security configuration:
```javascript
// In middleware/security.js
static createRateLimit() {
    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Increased limit
        message: { error: 'Too many requests' }
    });
}
```

## 🐳 Deployment

### Docker Deployment
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### PM2 Production Deployment
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name luna6969-video-server

# Save PM2 configuration
pm2 save
pm2 startup
```

### Environment Configuration
Set production environment variables:
```bash
export NODE_ENV=production
export PORT=3000
export LOG_LEVEL=WARN
export LOG_TO_FILE=true
```

## 📈 Performance Tuning

### Large Video Libraries
- Enable file system caching with longer TTL
- Implement database for metadata storage
- Use CDN for static file serving
- Consider video transcoding for multiple qualities

### Memory Optimization
- Adjust cache limits based on available memory
- Enable log file rotation
- Monitor memory usage via health endpoint

## 🔍 Troubleshooting

### Common Issues
- **EACCES errors**: Check directory permissions
- **FFmpeg not found**: Install FFmpeg and ensure it's in PATH
- **Python script fails**: Install Python 3 and required packages (PIL, ffmpeg-python)
- **High memory usage**: Reduce cache TTL values or limits

### Debug Mode
```bash
LOG_LEVEL=DEBUG npm start
```

## 📄 License
MIT License - see LICENSE file for details

---

**Luna6969 Video Server v2.0** - A modern, production-ready video management solution. 