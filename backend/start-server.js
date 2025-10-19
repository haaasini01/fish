#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting FishChain Backend Server...\n');

// Check if we're in the backend directory
const backendDir = path.join(__dirname);
process.chdir(backendDir);

// Start the server
const server = spawn('node', ['app.js'], {
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  console.log('\n💡 Make sure you have installed dependencies:');
  console.log('   npm install');
  process.exit(1);
});

server.on('close', (code) => {
  if (code !== 0) {
    console.log(`\n❌ Server exited with code ${code}`);
  } else {
    console.log('\n✅ Server stopped gracefully');
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...');
  server.kill('SIGINT');
});

console.log('📡 Server will be available at: http://localhost:8080/api');
console.log('🛑 Press Ctrl+C to stop the server\n');
