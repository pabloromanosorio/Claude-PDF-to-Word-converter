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
