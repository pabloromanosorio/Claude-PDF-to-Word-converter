require('dotenv').config();
const express = require('express');
const path = require('path');
// const open = require('open'); // Moved to dynamic import

const app = express();
const PORT = process.env.PORT || 3000;

const multer = require('multer');
const { validateUpload } = require('./lib/validator');
const { validateSettings } = require('./lib/settingsValidator');
const JobManager = require('./lib/jobManager');
const { convertPdf } = require('./lib/convertPdf');

// Initialize job manager
const jobManager = new JobManager();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

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

// POST /api/convert - Upload and convert PDF
app.post('/api/convert', upload.single('pdf'), async (req, res) => {
  let jobId = null;

  try {
    // Validate upload
    validateUpload(req.file);

    // Parse and validate settings
    let settings = {};
    if (req.body.settings) {
      // Limit settings JSON size to prevent DOS
      if (req.body.settings.length > 10000) {
        throw new Error('Settings JSON too large (max 10KB)');
      }
      settings = JSON.parse(req.body.settings);
      settings = validateSettings(settings);
    }

    // Add file MIME type to settings for conversion logic
    settings.mimeType = req.file.mimetype;

    // Create job
    const job = jobManager.createJob(
      req.file.originalname,
      req.file.size,
      settings
    );
    jobId = job.id;

    // Log if enabled
    if (settings.enableLogging) {
      console.log(`[${jobId}] Starting conversion: ${req.file.originalname} (${req.file.size} bytes)`);
    }

    // Return job ID immediately
    res.json({
      jobId: job.id,
      status: 'queued',
      message: 'Conversion started'
    });

    // Start conversion asynchronously
    convertPdf(req.file.buffer, job.id, settings, jobManager)
      .catch(error => {
        console.error(`[${jobId}] Conversion failed:`, error.message);
        jobManager.updateJob(jobId, {
          status: 'failed',
          error: error.message
        });
      });

  } catch (error) {
    // Validation or setup error
    if (jobId) {
      jobManager.deleteJob(jobId);
    }

    res.status(400).json({
      error: error.message
    });
  }
});

// GET /api/jobs/:jobId/status - Get job status
app.get('/api/jobs/:jobId/status', (req, res) => {
  const job = jobManager.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

// GET /api/download/:jobId - Download converted file
app.get('/api/download/:jobId', (req, res) => {
  const job = jobManager.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed' || !job.outputPath) {
    return res.status(400).json({ error: 'File not ready' });
  }

  const fs = require('fs');

  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="converted.docx"`);
  res.sendFile(job.outputPath);
});

// GET /api/api-key/status - Check if API key is configured
app.get('/api/api-key/status', (req, res) => {
  res.json({
    has_api_key: !!process.env.ANTHROPIC_API_KEY
  });
});

// POST /api/api-key - Save API key to .env
app.post('/api/api-key', express.json(), (req, res) => {
  try {
    const { api_key } = req.body;

    // Validate API key format
    if (!api_key || typeof api_key !== 'string') {
      return res.status(400).json({
        error: 'API key is required',
        details: 'Please provide a valid Anthropic API key'
      });
    }

    if (!api_key.startsWith('sk-ant-')) {
      return res.status(400).json({
        error: 'Invalid API key format',
        details: 'Anthropic API keys start with "sk-ant-"'
      });
    }

    if (api_key.length < 50) {
      return res.status(400).json({
        error: 'API key too short',
        details: 'Valid Anthropic API keys are typically 100+ characters long'
      });
    }

    // Validate it's not a placeholder
    if (api_key.includes('your-key') || api_key.includes('xxx') || api_key.length < 100) {
      return res.status(400).json({
        error: 'Invalid API key',
        details: 'Please use a real API key from https://console.anthropic.com/settings/keys'
      });
    }

    // Update .env file
    const fs = require('fs');
    const envPath = path.join(__dirname, '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add ANTHROPIC_API_KEY
    if (envContent.includes('ANTHROPIC_API_KEY=')) {
      envContent = envContent.replace(
        /ANTHROPIC_API_KEY=.*/g,
        `ANTHROPIC_API_KEY=${api_key}`
      );
    } else {
      envContent += `\nANTHROPIC_API_KEY=${api_key}\n`;
    }

    fs.writeFileSync(envPath, envContent);

    // Update process.env
    process.env.ANTHROPIC_API_KEY = api_key;

    console.log(`✓ API key saved (${api_key.length} characters)`);

    res.json({
      success: true,
      message: 'API key saved successfully',
      key_length: api_key.length
    });
  } catch (error) {
    console.error('Failed to save API key:', error);
    res.status(500).json({
      error: 'Failed to save API key',
      details: error.message
    });
  }
});

// GET /api/stats - Get usage statistics (stub for now)
app.get('/api/stats', (req, res) => {
  const stats = jobManager.getStats();

  // Add current active jobs to stats for real-time view
  const allJobs = Array.from(jobManager.jobs.values());
  const completedJobs = allJobs.filter(job => job.status === 'completed' && !job.statsRecorded);

  const responseStats = {
    total_conversions: stats.total_conversions + completedJobs.length,
    total_pages: stats.total_pages,
    total_cost: stats.total_cost + completedJobs.reduce((sum, job) => sum + (job.actualCost || 0), 0)
  };

  res.json(responseStats);
});

// Start server
app.listen(PORT, async () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n==================================================');
  console.log(`🚀 Server running at ${url}`);
  console.log('==================================================');
  console.log('👉 If the browser does not open automatically,');
  console.log(`👉 please copy and paste this URL into your browser:`);
  console.log(`\n   ${url}\n`);
  console.log('==================================================\n');

  // Auto-open browser
  try {
    const open = (await import('open')).default;
    await open(url);
    console.log('✓ Attempted to open browser');
  } catch (error) {
    console.log('× Could not open browser automatically');
  }
});
