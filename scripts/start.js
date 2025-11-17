#!/usr/bin/env node

const { spawn } = require('child_process');
const open = require('open');
const path = require('path');

console.log('🚀 Starting PDF to DOCX Converter...\n');

// Start server
const serverPath = path.join(__dirname, '..', 'server.js');
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { ...process.env }
});

// Wait 2 seconds then open browser
setTimeout(async () => {
  const url = 'http://localhost:3000';
  try {
    await open(url);
    console.log('\n✅ Browser opened to', url);
  } catch (error) {
    console.log('\n⚠️  Could not auto-open browser');
    console.log('   Please open:', url);
  }
}, 2000);

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  server.kill();
  process.exit(0);
});
