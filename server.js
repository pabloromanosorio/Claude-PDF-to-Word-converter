require('dotenv').config();
const express = require('express');
const path = require('path');
const open = require('open');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Start server
app.listen(PORT, async () => {
  const url = `http://localhost:${PORT}`;
  console.log(`✓ Server running at ${url}`);
  console.log(`✓ Frontend available at ${url}`);

  // Auto-open browser
  try {
    await open(url);
    console.log('✓ Browser opened');
  } catch (error) {
    console.log('× Could not open browser automatically');
    console.log(`  Please open: ${url}`);
  }
});
