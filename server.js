require('dotenv').config();
const express = require('express');
const path = require('path');
const open = require('open');

const app = express();
const PORT = process.env.PORT || 3000;

const multer = require('multer');
const { validateUpload } = require('./lib/validator');
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

    // Parse settings
    const settings = req.body.settings ? JSON.parse(req.body.settings) : {};

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

    if (!api_key || !api_key.startsWith('sk-ant-')) {
      return res.status(400).json({ error: 'Invalid API key format' });
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
        /ANTHROPIC_API_KEY=.*/,
        `ANTHROPIC_API_KEY=${api_key}`
      );
    } else {
      envContent += `\nANTHROPIC_API_KEY=${api_key}\n`;
    }

    fs.writeFileSync(envPath, envContent);

    // Update process.env
    process.env.ANTHROPIC_API_KEY = api_key;

    res.json({ success: true, message: 'API key saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stats - Get usage statistics (stub for now)
app.get('/api/stats', (req, res) => {
  // Calculate stats from current jobs
  const allJobs = Array.from(jobManager.jobs.values());
  const completedJobs = allJobs.filter(job => job.status === 'completed');

  const stats = {
    total_conversions: completedJobs.length,
    total_pages: 0, // Not tracked yet
    total_cost: completedJobs.reduce((sum, job) => sum + (job.actualCost || 0), 0)
  };

  res.json(stats);
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
