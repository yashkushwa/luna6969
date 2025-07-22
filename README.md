# 🎬 Luna6969 Video Server v2.0

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Luna6969 Video Server v2.0** is a modern, production-ready Node.js video management and streaming server with advanced features for thumbnail generation, video processing, and comprehensive API management.

## ✨ Features

- 🎥 **Video Management** - Browse, play, rename, and delete videos
- 🖼️ **Smart Thumbnails** - Automatic thumbnail generation with caching
- 🎞️ **Sprite Previews** - Hover thumbnails for video seeking
- 📊 **Pagination & Search** - Efficient browsing for large libraries
- 🔒 **Security** - CORS, rate limiting, input validation, security headers
- ⚡ **Performance** - Multi-tier caching, compression, optimized file serving
- 📈 **Monitoring** - Health checks, statistics, structured logging
- 🛠️ **Modern Architecture** - Service layer, middleware, async/await patterns

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Create directories
mkdir -p videos thumbnails processed

# Start the server
npm start

# Open in browser
open http://localhost:3000
```

## 📋 Requirements

- **Node.js** 16+ 
- **FFmpeg** for video processing
- **Python 3** for sprite generation (with PIL and ffmpeg-python packages)

## 🏗️ Architecture

### Service Layer Pattern
- **VideoService** - Video operations and metadata management
- **ThumbnailService** - Thumbnail generation and caching
- **ConfigManager** - Centralized configuration with hot-reload
- **CacheManager** - Multi-tier caching system

### Security & Performance
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Abuse prevention
- **Input Validation** - Joi schemas
- **Compression** - Response optimization
- **Caching** - Memory-efficient with TTL

## 📁 Project Structure

```
├── controllers/         # API request handlers
├── services/           # Business logic layer  
├── middleware/         # Express middleware
├── utils/             # Utilities and helpers
├── routes/            # API route definitions
├── public/            # Frontend application
├── scripts/           # External utilities
└── config.json        # Application configuration
```

## 🔌 API Endpoints

### Core Endpoints
- `GET /api/videos` - Paginated video listing with search/sort
- `GET /api/stats` - System statistics
- `GET /api/health` - Health check

### Video Operations  
- `POST /api/refresh-thumbnail/:id` - Regenerate thumbnail
- `POST /api/generate-sprite/:id` - Create hover previews
- `POST /api/rename-video/:id` - Rename video and files
- `DELETE /api/delete-video/:id` - Delete video and files
- `POST /api/cleanup` - Remove orphaned files

## ⚙️ Configuration

### Environment Variables (.env)
```bash
PORT=3000
NODE_ENV=development
LOG_LEVEL=INFO
RATE_LIMIT_MAX=100
```

### Config File (config.json)
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
  }
}
```

## 🎯 Usage Examples

### Adding Videos
1. Copy video files to the `videos/` directory
2. Server automatically generates thumbnails on first access
3. Use web interface or API to manage videos

### Generating Sprite Previews
```bash
curl -X POST http://localhost:3000/api/generate-sprite/1
```

### Searching Videos
```bash
curl "http://localhost:3000/api/videos?search=vacation&sort=date&order=desc"
```

## 🔧 Development

### Start in Development Mode
```bash
npm run dev  # Uses nodemon for auto-reload
```

### Available Scripts
- `npm start` - Production start
- `npm run dev` - Development with auto-reload
- `npm test` - Run tests (placeholder)

### Adding New Features
1. Create service in `services/` for business logic
2. Add controller method in `controllers/`
3. Define route in `routes/` with validation
4. Update frontend if needed

## 🐳 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### PM2 Process Manager
```bash
pm2 start server.js --name luna6969-video-server
pm2 save && pm2 startup
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Statistics
```bash
curl http://localhost:3000/api/stats
```

### Logging
- Console output with timestamps and colors
- Optional file logging with structured JSON
- HTTP request logging with performance metrics

## 🛠️ Customization

### Supported Video Formats
Edit `services/videoService.js`:
```javascript
this.supportedFormats = ['.mp4', '.webm', '.mov', '.mkv', '.avi'];
```

### Thumbnail Settings
Update `config.json`:
```json
{
  "thumbnails": {
    "width": 640,
    "height": 360,
    "quality": 3
  }
}
```

### Cache Configuration
```json
{
  "cache": {
    "videoMetadata": 600,  // 10 minutes
    "thumbnails": 7200,    // 2 hours
    "sprites": 14400       // 4 hours
  }
}
```

## 🔍 Troubleshooting

### Common Issues

**EACCES Permission Denied**
```bash
sudo chown -R $USER:$USER videos/ thumbnails/ processed/
```

**FFmpeg Not Found**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/
```

**Python Script Errors**
```bash
pip3 install Pillow ffmpeg-python
```

### Debug Mode
```bash
LOG_LEVEL=DEBUG npm start
```

## 📚 Documentation

- [OVERVIEW.md](OVERVIEW.md) - Comprehensive technical documentation
- [API Reference] - Interactive API documentation at `/api`
- [Configuration Guide] - Detailed configuration options

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [FFmpeg](https://ffmpeg.org/) - Video processing
- [Plyr](https://plyr.io/) - Video player
- [Helmet](https://helmetjs.github.io/) - Security middleware

---

**Made with ❤️ for video enthusiasts**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/luna6969-video-server?style=social)](https://github.com/yourusername/luna6969-video-server)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/luna6969-video-server?style=social)](https://github.com/yourusername/luna6969-video-server)
