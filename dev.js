const { spawn } = require('child_process');
const path = require('path');

// Start the backend server
console.log('Starting backend server...');
const server = spawn('node', ['server.js'], {
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'inherit'
});

// Start the Vite dev server
console.log('Starting Vite dev server...');
const vite = spawn('npx', ['vite'], {
  stdio: 'inherit'
});

// Handle termination
const cleanup = () => {
  console.log('Shutting down servers...');
  server.kill();
  vite.kill();
};

server.on('close', (code) => {
  console.log(`Backend server process exited with code ${code}`);
  vite.kill();
  process.exit(code);
});

vite.on('close', (code) => {
  console.log(`Vite dev server process exited with code ${code}`);
  server.kill();
  process.exit(code);
});

// Handle termination signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup); 