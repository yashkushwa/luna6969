// Initialize logger (patches console methods)
require('./utils/logger');

const express = require('express');
const path = require('path');
const videoRoutes = require('./routes/videoRoutes');

// Load configuration
let config;
try {
    config = JSON.parse(require('fs').readFileSync('./config.json', 'utf8'));
} catch (error) {
    console.error('Error loading config.json:', error.message);
    console.log('Using default configuration...');
    config = {
        directories: {
            videos: './videos',
            thumbnails: './thumbnails',
            processed: './processed'
        },
        server: {
            port: 3000
        }
    };
}

const PORT = config.server.port;
const VIDEOS_DIR = path.resolve(config.directories.videos);
const THUMBNAILS_DIR = path.resolve(config.directories.thumbnails);
const PROCESSED_DIR = path.resolve(config.directories.processed);

// Initialize Express
const app = express();
app.use(express.json());

// Serve static files
app.use('/videos', express.static(VIDEOS_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));
app.use('/processed', express.static(PROCESSED_DIR));

// API routes
app.use('/api', videoRoutes);

// For development, serve the old public folder
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
}

// For production, serve the built React app
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    
    // All other GET requests not handled before will return the React app
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Configuration loaded:');
    console.log(`  Videos directory: ${VIDEOS_DIR}`);
    console.log(`  Thumbnails directory: ${THUMBNAILS_DIR}`);
    console.log(`  Processed directory: ${PROCESSED_DIR}`);
}); 