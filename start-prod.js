const { spawn, execSync } = require('child_process');
const path = require('path');

// Build the React app
console.log('Building React app...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('Error building React app:', error);
  process.exit(1);
}

// Start the server in production mode
console.log('Starting server in production mode...');
const server = spawn('node', ['server.js'], {
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: 'inherit'
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  server.kill('SIGTERM');
}); 