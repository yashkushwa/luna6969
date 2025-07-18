# Luna6969 Video Library

A modern video library application built with React, Vite, and Express.

## Features

- Video library with thumbnail previews
- Video player with seek preview thumbnails using Plyr
- Context menu for video actions (play, rename, delete, refresh thumbnail, generate sprite)
- Responsive design for mobile and desktop

## Tech Stack

- **Frontend**: React, React Router, Axios
- **Backend**: Express.js
- **Build Tool**: Vite
- **Video Player**: Plyr

## Development

To start the development environment with both the backend server and Vite dev server:

```bash
npm run dev
```

This will start:
- Backend server on port 3000
- Vite dev server on port 5173 (with proxy to backend)

### Other Scripts

- `npm run dev:vite` - Run only the Vite dev server
- `npm run dev:server` - Run only the backend server in development mode
- `npm run build` - Build the React application
- `npm run prod` - Build and run the application in production mode

## Production

To build and run the application in production mode:

```bash
npm run prod
```

This will:
1. Build the React application
2. Start the server in production mode, serving the built React app

## API Endpoints

- `GET /api/videos` - Get all videos
- `POST /api/refresh-thumbnail/:id` - Refresh thumbnail for a video
- `POST /api/generate-sprite/:id` - Generate sprite and VTT for a video
- `POST /api/rename-video/:id` - Rename a video
- `DELETE /api/delete-video/:id` - Delete a video

## Configuration

Configuration is loaded from `config.json` in the project root:

```json
{
  "directories": {
    "videos": "./videos",
    "thumbnails": "./thumbnails",
    "processed": "./processed"
  },
  "server": {
    "port": 3000
  }
}
``` 