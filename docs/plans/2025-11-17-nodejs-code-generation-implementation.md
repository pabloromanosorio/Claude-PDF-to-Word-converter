# Node.js Code Generation PDF to DOCX Converter - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild PDF to DOCX converter using Node.js + Express with code generation approach from MD documentation files.

**Architecture:** Express server receives PDF uploads, calls Claude API to generate JavaScript code using docx library, executes generated code in isolated directories, returns DOCX files. In-memory job storage with REST polling for status. Two deployment modes: terminal (npm start) and packaged app (double-click).

**Tech Stack:** Node.js 18+, Express, Anthropic SDK, docx library, multer, child_process, pkg (for packaging)

---

## Task 1: Initialize Node.js Project

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `server.js` (empty starter)

**Step 1: Create package.json**

Create `package.json`:

```json
{
  "name": "pdf-to-docx-converter",
  "version": "2.0.0",
  "description": "PDF to DOCX converter using Claude API code generation",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "keywords": ["pdf", "docx", "converter", "claude", "anthropic"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "docx": "^8.5.0",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.3.1",
    "open": "^10.0.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.0.2",
    "supertest": "^6.3.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 2: Create .nvmrc**

Create `.nvmrc`:

```
18
```

**Step 3: Create empty server.js**

Create `server.js`:

```javascript
// Main server file - to be implemented
console.log('PDF to DOCX Converter - Starting...');
```

**Step 4: Install dependencies**

Run: `npm install`

Expected: Dependencies installed successfully, `node_modules/` and `package-lock.json` created

**Step 5: Commit**

```bash
git add package.json .nvmrc server.js package-lock.json
git commit -m "chore: initialize Node.js project with dependencies

- Express server
- Anthropic SDK
- docx library for generated code
- Multer for file uploads
- Testing setup with Jest"
```

---

## Task 2: Create Basic Express Server

**Files:**
- Modify: `server.js`
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: Implement basic Express server**

Replace content of `server.js`:

```javascript
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
```

**Step 2: Create .env.example**

Create `.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3000
NODE_ENV=development
```

**Step 3: Update .gitignore**

Add to `.gitignore`:

```
# Node.js
node_modules/
package-lock.json
.env

# Temporary conversion files
/tmp/conversion-*
```

**Step 4: Test server**

Run: `npm start`

Expected:
- Server starts on port 3000
- Browser opens automatically
- Can access http://localhost:3000
- Health check responds at /api/health

**Step 5: Commit**

```bash
git add server.js .env.example .gitignore
git commit -m "feat: add basic Express server with auto-open browser

- Health check endpoint
- Static file serving for frontend
- Auto-opens browser on startup
- Environment configuration"
```

---

## Task 3: Implement Conversion Engine Core

**Files:**
- Create: `lib/converter.js`
- Create: `lib/converter.test.js`

**Step 1: Write failing test**

Create `lib/converter.test.js`:

```javascript
const { buildConversionPrompt, validateGeneratedCode } = require('./converter');

describe('Converter', () => {
  describe('buildConversionPrompt', () => {
    test('includes critical instructions', () => {
      const settings = {
        model: 'claude-haiku-4-5-20251001',
        font: 'Arial',
        preserveTableFormatting: true
      };
      const workDir = '/tmp/test-123';

      const prompt = buildConversionPrompt(settings, workDir);

      expect(prompt).toContain('Read /mnt/skills/public/docx/SKILL.md');
      expect(prompt).toContain('Read /mnt/skills/public/docx/docx-js.md');
      expect(prompt).toContain('ALL PAGES');
      expect(prompt).toContain(workDir);
    });

    test('includes font preference when specified', () => {
      const settings = { font: 'Times New Roman' };
      const prompt = buildConversionPrompt(settings, '/tmp/test');

      expect(prompt).toContain('Times New Roman');
    });

    test('includes table preservation when enabled', () => {
      const settings = { preserveTableFormatting: true };
      const prompt = buildConversionPrompt(settings, '/tmp/test');

      expect(prompt).toContain('table');
    });
  });

  describe('validateGeneratedCode', () => {
    test('accepts valid docx code', () => {
      const validCode = 'const { Document, Packer } = require("docx");';

      expect(() => validateGeneratedCode(validCode)).not.toThrow();
    });

    test('rejects code without Document import', () => {
      const invalidCode = 'console.log("hello");';

      expect(() => validateGeneratedCode(invalidCode)).toThrow('Invalid code');
    });

    test('removes markdown code blocks', () => {
      const codeWithMarkdown = '```javascript\nconst { Document, Packer } = require("docx");\n```';
      const cleaned = validateGeneratedCode(codeWithMarkdown);

      expect(cleaned).not.toContain('```');
      expect(cleaned).toContain('Document');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test lib/converter.test.js`

Expected: FAIL with "Cannot find module './converter'"

**Step 3: Write minimal implementation**

Create `lib/converter.js`:

```javascript
/**
 * Converter utilities for PDF to DOCX conversion
 */

/**
 * Build conversion prompt for Claude API
 * @param {Object} settings - User settings
 * @param {string} workDir - Working directory path
 * @returns {string} Complete conversion prompt
 */
function buildConversionPrompt(settings, workDir) {
  const {
    font = 'Arial',
    fontSize = 12,
    margins = {},
    preserveTableFormatting = true,
    addPageMarkers = false,
    replaceSignatures = false,
    overrideFormatting = false
  } = settings;

  let prompt = `Convert this PDF to DOCX format.

CRITICAL INSTRUCTIONS:
1. Read /mnt/skills/public/docx/SKILL.md completely (no range limits)
2. Read /mnt/skills/public/docx/docx-js.md completely (no range limits)
3. Analyze PDF structure (headers, tables, formatting)
4. Generate JavaScript using docx library that:
   - Preserves ALL content from ALL PAGES
   - DO NOT stop after page 1 or page 2
   - Process EVERY SINGLE PAGE in the document
   - Recreates tables with borders
   - Maintains formatting (bold, italic, alignment)`;

  if (overrideFormatting) {
    const marginTop = margins.top || 1440;
    const marginBottom = margins.bottom || 1440;
    const marginLeft = margins.left || 1440;
    const marginRight = margins.right || 1440;

    prompt += `\n   - Uses ${font} ${fontSize}pt font`;
    prompt += `\n   - Margins: Top ${marginTop}, Bottom ${marginBottom}, Left ${marginLeft}, Right ${marginRight} DXA`;
  } else {
    prompt += `\n   - Preserves original formatting`;
  }

  if (preserveTableFormatting) {
    prompt += `\n   - Preserves table structures with proper borders`;
  }

  if (addPageMarkers) {
    prompt += `\n   - Adds page markers: [Page 2 of original document:], [Page 3 of original document:], etc.`;
    prompt += `\n   - Start markers from page 2 (not page 1)`;
  }

  if (replaceSignatures) {
    prompt += `\n   - Replaces signature images with: [Signature]`;
  }

  prompt += `\n   - Handles special characters correctly
   - Saves to ${workDir}/outputs/converted.docx

FORMATTING REQUIREMENTS:
- Never use \\n for line breaks - use separate Paragraph elements
- Tables: Set both columnWidths AND individual cell widths
- Borders: Apply to TableCell elements using BorderStyle.SINGLE
- Shading: Use ShadingType.CLEAR for headers (gray #D9D9D9)

Output ONLY executable JavaScript code, no explanations.`;

  return prompt;
}

/**
 * Validate and clean generated code
 * @param {string} code - Generated JavaScript code
 * @returns {string} Cleaned code
 * @throws {Error} If code is invalid
 */
function validateGeneratedCode(code) {
  // Remove markdown code blocks
  let cleaned = code
    .replace(/```javascript\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Validate required imports
  if (!cleaned.includes('Document') || !cleaned.includes('Packer')) {
    throw new Error('Invalid code generated - missing required docx imports');
  }

  return cleaned;
}

module.exports = {
  buildConversionPrompt,
  validateGeneratedCode
};
```

**Step 4: Run test to verify it passes**

Run: `npm test lib/converter.test.js`

Expected: PASS (all tests pass)

**Step 5: Commit**

```bash
git add lib/converter.js lib/converter.test.js
git commit -m "feat: add conversion prompt builder and code validator

- buildConversionPrompt: creates Claude API prompt with settings
- validateGeneratedCode: cleans and validates generated code
- Emphasizes ALL PAGES processing
- Includes user settings (font, margins, tables)
- Test coverage for both functions"
```

---

## Task 4: Implement Job Management

**Files:**
- Create: `lib/jobManager.js`
- Create: `lib/jobManager.test.js`

**Step 1: Write failing test**

Create `lib/jobManager.test.js`:

```javascript
const JobManager = require('./jobManager');

describe('JobManager', () => {
  let manager;

  beforeEach(() => {
    manager = new JobManager();
  });

  test('creates job with unique ID', () => {
    const job = manager.createJob('test.pdf', 1024);

    expect(job.id).toBeDefined();
    expect(job.filename).toBe('test.pdf');
    expect(job.fileSize).toBe(1024);
    expect(job.status).toBe('queued');
  });

  test('retrieves job by ID', () => {
    const created = manager.createJob('test.pdf', 1024);
    const retrieved = manager.getJob(created.id);

    expect(retrieved).toEqual(created);
  });

  test('updates job status', () => {
    const job = manager.createJob('test.pdf', 1024);

    manager.updateJob(job.id, {
      status: 'processing',
      progress: 50
    });

    const updated = manager.getJob(job.id);
    expect(updated.status).toBe('processing');
    expect(updated.progress).toBe(50);
  });

  test('deletes job', () => {
    const job = manager.createJob('test.pdf', 1024);

    manager.deleteJob(job.id);

    const retrieved = manager.getJob(job.id);
    expect(retrieved).toBeNull();
  });

  test('cleans up old jobs', () => {
    const job = manager.createJob('test.pdf', 1024);

    // Manually set old timestamp (1 hour + 1 minute ago)
    job.createdAt = Date.now() - (61 * 60 * 1000);

    manager.cleanupOldJobs();

    const retrieved = manager.getJob(job.id);
    expect(retrieved).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test lib/jobManager.test.js`

Expected: FAIL with "Cannot find module './jobManager'"

**Step 3: Write minimal implementation**

Create `lib/jobManager.js`:

```javascript
const crypto = require('crypto');

/**
 * In-memory job management
 */
class JobManager {
  constructor() {
    this.jobs = new Map();

    // Start periodic cleanup (every 10 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, 10 * 60 * 1000);
  }

  /**
   * Create a new job
   * @param {string} filename - Original filename
   * @param {number} fileSize - File size in bytes
   * @param {Object} settings - Conversion settings
   * @returns {Object} Created job
   */
  createJob(filename, fileSize, settings = {}) {
    const job = {
      id: crypto.randomUUID(),
      filename,
      fileSize,
      settings,
      status: 'queued',
      progress: 0,
      currentStep: 'Initializing...',
      outputPath: null,
      error: null,
      inputTokens: null,
      outputTokens: null,
      actualCost: null,
      createdAt: Date.now(),
      completedAt: null
    };

    this.jobs.set(job.id, job);
    return job;
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Object|null} Job or null if not found
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Update job
   * @param {string} jobId - Job ID
   * @param {Object} updates - Fields to update
   */
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
    }
  }

  /**
   * Delete job
   * @param {string} jobId - Job ID
   */
  deleteJob(jobId) {
    this.jobs.delete(jobId);
  }

  /**
   * Clean up jobs older than 1 hour
   */
  cleanupOldJobs() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [jobId, job] of this.jobs.entries()) {
      if (now - job.createdAt > oneHour) {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Stop cleanup interval (for testing)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = JobManager;
```

**Step 4: Run test to verify it passes**

Run: `npm test lib/jobManager.test.js`

Expected: PASS (all tests pass)

**Step 5: Commit**

```bash
git add lib/jobManager.js lib/jobManager.test.js
git commit -m "feat: add in-memory job management system

- JobManager class for job CRUD operations
- Auto-cleanup of jobs older than 1 hour
- Tracks status, progress, costs, tokens
- Full test coverage"
```

---

## Task 5: Implement File Upload Validation

**Files:**
- Create: `lib/validator.js`
- Create: `lib/validator.test.js`

**Step 1: Write failing test**

Create `lib/validator.test.js`:

```javascript
const { validateUpload } = require('./validator');

describe('Validator', () => {
  describe('validateUpload', () => {
    test('accepts valid PDF', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test')
      };

      expect(() => validateUpload(file)).not.toThrow();
    });

    test('rejects missing file', () => {
      expect(() => validateUpload(null)).toThrow('No file uploaded');
    });

    test('rejects oversized file', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024, // 11MB
        buffer: Buffer.from('test')
      };

      expect(() => validateUpload(file)).toThrow('File too large');
    });

    test('rejects non-PDF file', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test')
      };

      expect(() => validateUpload(file)).toThrow('Only PDF files allowed');
    });

    test('rejects empty file', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 0,
        buffer: Buffer.from('')
      };

      expect(() => validateUpload(file)).toThrow('Empty file');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test lib/validator.test.js`

Expected: FAIL with "Cannot find module './validator'"

**Step 3: Write minimal implementation**

Create `lib/validator.js`:

```javascript
/**
 * File validation utilities
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate uploaded file
 * @param {Object} file - Uploaded file from multer
 * @throws {Error} If validation fails
 */
function validateUpload(file) {
  // Check file exists
  if (!file) {
    throw new Error('No file uploaded');
  }

  // Check file size
  if (file.size === 0) {
    throw new Error('Empty file');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large (max 10MB)');
  }

  // Check file type
  if (file.mimetype !== 'application/pdf') {
    throw new Error('Only PDF files allowed');
  }
}

module.exports = {
  validateUpload
};
```

**Step 4: Run test to verify it passes**

Run: `npm test lib/validator.test.js`

Expected: PASS (all tests pass)

**Step 5: Commit**

```bash
git add lib/validator.js lib/validator.test.js
git commit -m "feat: add file upload validation

- validateUpload: checks file type, size, existence
- 10MB max file size
- PDF only
- Full test coverage"
```

---

## Task 6: Implement Conversion API Endpoint

**Files:**
- Modify: `server.js`
- Create: `lib/convertPdf.js`

**Step 1: Add multer middleware to server.js**

Add to `server.js` after `const PORT = ...`:

```javascript
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
```

**Step 2: Add conversion endpoint to server.js**

Add before `app.listen(...)`:

```javascript
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
```

**Step 3: Add status endpoint to server.js**

Add before `app.listen(...)`:

```javascript
// GET /api/jobs/:jobId/status - Get job status
app.get('/api/jobs/:jobId/status', (req, res) => {
  const job = jobManager.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});
```

**Step 4: Add download endpoint to server.js**

Add before `app.listen(...)`:

```javascript
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
```

**Step 5: Create convertPdf stub**

Create `lib/convertPdf.js`:

```javascript
/**
 * PDF conversion implementation
 */

async function convertPdf(pdfBuffer, jobId, settings, jobManager) {
  // TODO: Implement conversion logic
  throw new Error('Not implemented yet');
}

module.exports = { convertPdf };
```

**Step 6: Test endpoints**

Run: `npm start`

Then in another terminal:

```bash
# Test health
curl http://localhost:3000/api/health

# Test upload (will fail with "Not implemented yet" - expected)
curl -X POST http://localhost:3000/api/convert \
  -F "pdf=@test.pdf" \
  -F "settings={}"
```

Expected:
- Health check returns 200
- Upload returns jobId
- Status shows "queued" then "failed" with "Not implemented yet"

**Step 7: Commit**

```bash
git add server.js lib/convertPdf.js
git commit -m "feat: add conversion API endpoints

- POST /api/convert: upload and convert PDF
- GET /api/jobs/:id/status: check conversion status
- GET /api/download/:id: download converted file
- Async conversion with immediate job ID return
- Stub for convertPdf implementation"
```

---

## Task 7: Implement Core Conversion Logic

**Files:**
- Modify: `lib/convertPdf.js`

**Step 1: Implement convertPdf function**

Replace content of `lib/convertPdf.js`:

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildConversionPrompt, validateGeneratedCode } = require('./converter');

const MODEL_PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 }
};

/**
 * Convert PDF to DOCX using Claude API
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} jobId - Job ID
 * @param {Object} settings - Conversion settings
 * @param {JobManager} jobManager - Job manager instance
 */
async function convertPdf(pdfBuffer, jobId, settings, jobManager) {
  const workDir = `/tmp/conversion-${jobId}`;
  const enableLogging = settings.enableLogging || false;

  const log = (message) => {
    if (enableLogging) {
      console.log(`[${jobId}] ${message}`);
    }
  };

  try {
    // Step 1: Setup directories
    jobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      currentStep: 'Setting up workspace'
    });

    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(path.join(workDir, 'outputs'), { recursive: true });

    log('Workspace created');

    // Step 2: Convert PDF to base64
    jobManager.updateJob(jobId, {
      progress: 20,
      currentStep: 'Encoding PDF'
    });

    const base64Pdf = pdfBuffer.toString('base64');
    log(`PDF encoded (${base64Pdf.length} chars)`);

    // Step 3: Build prompt
    jobManager.updateJob(jobId, {
      progress: 30,
      currentStep: 'Preparing API request'
    });

    const prompt = buildConversionPrompt(settings, workDir);

    // Step 4: Call Claude API
    jobManager.updateJob(jobId, {
      progress: 40,
      currentStep: 'Calling Claude API...'
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({ apiKey });
    const model = settings.model || 'claude-haiku-4-5-20251001';

    log(`Calling Claude API with ${model}`);
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    const apiTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`API responded in ${apiTime}s`);

    // Step 5: Extract and validate code
    jobManager.updateJob(jobId, {
      progress: 70,
      currentStep: 'Validating generated code'
    });

    let code = response.content[0].text;
    code = validateGeneratedCode(code);

    // Update output path in code
    code = code.replace(
      /\/mnt\/user-data\/outputs\//g,
      `${workDir}/outputs/`
    );

    log('Code validated');

    // Step 6: Save and execute code
    jobManager.updateJob(jobId, {
      progress: 80,
      currentStep: 'Generating DOCX file'
    });

    const scriptPath = path.join(workDir, 'convert.js');
    fs.writeFileSync(scriptPath, code);

    log('Executing generated code...');
    const execStart = Date.now();

    execSync(`node convert.js`, {
      cwd: workDir,
      timeout: 30000, // 30 seconds
      stdio: 'pipe'
    });

    const execTime = ((Date.now() - execStart) / 1000).toFixed(1);
    log(`Code executed in ${execTime}s`);

    // Step 7: Verify output
    jobManager.updateJob(jobId, {
      progress: 90,
      currentStep: 'Verifying output'
    });

    const outputFiles = fs.readdirSync(path.join(workDir, 'outputs'));
    if (outputFiles.length === 0) {
      throw new Error('No output file created');
    }

    const outputPath = path.join(workDir, 'outputs', outputFiles[0]);
    log(`Output created: ${outputFiles[0]}`);

    // Step 8: Calculate cost
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-haiku-4-5-20251001'];
    const cost = (inputTokens / 1_000_000) * pricing.input +
                 (outputTokens / 1_000_000) * pricing.output;

    log(`Tokens: ${inputTokens} input, ${outputTokens} output`);
    log(`Cost: $${cost.toFixed(4)}`);

    // Step 9: Update job as completed
    jobManager.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'Complete',
      outputPath,
      inputTokens,
      outputTokens,
      actualCost: cost,
      completedAt: Date.now()
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✓ Conversion complete (${totalTime}s total)`);

    // Step 10: Schedule cleanup (5 minutes)
    setTimeout(() => {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
      jobManager.deleteJob(jobId);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error(`[${jobId}] Conversion failed:`, error.message);

    jobManager.updateJob(jobId, {
      status: 'failed',
      error: error.message
    });

    // Cleanup on error
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }

    throw error;
  }
}

module.exports = { convertPdf };
```

**Step 2: Test conversion**

Run: `npm start`

Then:

```bash
# Create .env file
echo "ANTHROPIC_API_KEY=your-key-here" > .env

# Test conversion
curl -X POST http://localhost:3000/api/convert \
  -F "pdf=@sample.pdf" \
  -F 'settings={"model":"claude-haiku-4-5-20251001","enableLogging":true}'

# Get job ID from response, then check status
curl http://localhost:3000/api/jobs/{jobId}/status
```

Expected: Conversion completes successfully, file created, status shows "completed"

**Step 3: Commit**

```bash
git add lib/convertPdf.js
git commit -m "feat: implement PDF to DOCX conversion engine

- convertPdf: full conversion flow with progress tracking
- Claude API integration with document upload
- Code generation, validation, and execution
- Cost calculation and token tracking
- Logging support
- Auto-cleanup after 5 minutes
- Error handling with workspace cleanup"
```

---

## Task 8: Update Frontend API Calls

**Files:**
- Modify: `frontend/js/app.js`

**Step 1: Update API_BASE constant**

Find and replace in `frontend/js/app.js`:

```javascript
// Old (if exists)
const API_BASE = 'http://localhost:8000';

// New
const API_BASE = 'http://localhost:3000';
```

**Step 2: Update convertBatch function**

Find `convertBatch` function and ensure it sends settings correctly:

```javascript
async function convertBatch() {
    // ... existing code ...

    const settings = {
        override_formatting: overrideFormatting,
        font: 'Arial',
        font_size: 12,
        margin_top: marginVertical * 1440,
        margin_bottom: marginVertical * 1440,
        margin_left: marginHorizontal * 1440,
        margin_right: marginHorizontal * 1440,
        model: document.querySelector('input[name="model"]:checked').value,
        enableLogging: localStorage.getItem('enableLogging') === 'true',
        add_page_markers: document.getElementById('page-markers').checked,
        replace_signatures: document.getElementById('replace-signatures').checked,
        preserve_table_formatting: document.getElementById('preserve-tables').checked,
        handle_merged_cells: true
    };

    // For each file
    for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('settings', JSON.stringify(settings));

        const response = await fetch(`${API_BASE}/api/convert`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            jobIds.push(data.jobId);

            // Start polling for this job
            pollJobStatus(data.jobId);
        }
    }
}
```

**Step 3: Add pollJobStatus function**

Add after `convertBatch`:

```javascript
function pollJobStatus(jobId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/jobs/${jobId}/status`);
            const job = await response.json();

            // Update progress UI
            updateJobProgress(jobId, job.progress, job.currentStep);

            if (job.status === 'completed') {
                clearInterval(interval);
                showDownloadButton(jobId);

                // Show cost if available
                if (job.actualCost) {
                    console.log(`Job ${jobId} cost: $${job.actualCost.toFixed(4)}`);
                }
            } else if (job.status === 'failed') {
                clearInterval(interval);
                showError(jobId, job.error);
            }
        } catch (error) {
            console.error('Polling error:', error);
            clearInterval(interval);
        }
    }, 2000); // Poll every 2 seconds
}
```

**Step 4: Update download function**

Update download URL:

```javascript
function showDownloadButton(jobId) {
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.onclick = () => {
        window.location.href = `${API_BASE}/api/download/${jobId}`;
    };
    // ... append to UI ...
}
```

**Step 5: Test frontend**

Run: `npm start`

Navigate to `http://localhost:3000` and:
1. Upload a PDF
2. Verify progress updates
3. Verify download button appears
4. Verify file downloads

Expected: Full conversion flow works end-to-end

**Step 6: Commit**

```bash
git add frontend/js/app.js
git commit -m "feat: update frontend for Node.js API

- Update API_BASE to port 3000
- Use REST polling instead of WebSocket
- Send settings as JSON with FormData
- Poll job status every 2 seconds
- Show download button when complete
- Display costs in console when available"
```

---

## Task 9: Add API Key Management

**Files:**
- Modify: `server.js`

**Step 1: Add API key endpoints**

Add before `app.listen(...)` in `server.js`:

```javascript
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
```

**Step 2: Test API key endpoints**

Run: `npm start`

Then:

```bash
# Check status
curl http://localhost:3000/api/api-key/status

# Save API key
curl -X POST http://localhost:3000/api/api-key \
  -H "Content-Type: application/json" \
  -d '{"api_key":"sk-ant-test-key"}'
```

Expected: API key saved to .env, status returns has_api_key: true

**Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add API key management endpoints

- GET /api/api-key/status: check if key configured
- POST /api/api-key: save key to .env file
- Updates both .env and process.env
- Validates key format (starts with sk-ant-)"
```

---

## Task 10: Add Auto-Open Browser Script

**Files:**
- Create: `scripts/start.js`
- Modify: `package.json`

**Step 1: Create start script**

Create `scripts/start.js`:

```javascript
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
```

**Step 2: Make script executable**

Run: `chmod +x scripts/start.js`

**Step 3: Update package.json**

Update scripts in `package.json`:

```json
{
  "scripts": {
    "start": "node scripts/start.js",
    "server": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  }
}
```

**Step 4: Test start script**

Run: `npm start`

Expected: Server starts, browser opens after 2 seconds

**Step 5: Commit**

```bash
git add scripts/start.js package.json
chmod +x scripts/start.js
git add --chmod=+x scripts/start.js
git commit -m "feat: add auto-open browser start script

- scripts/start.js: starts server and opens browser
- 2 second delay for server startup
- Handles SIGINT for clean shutdown
- npm start now auto-opens browser"
```

---

## Task 11: Create Packaged App Launcher

**Files:**
- Create: `launcher.js`
- Modify: `package.json`
- Create: `pkg-config.json`

**Step 1: Create launcher**

Create `launcher.js`:

```javascript
#!/usr/bin/env node

/**
 * Packaged app launcher
 * Starts server and opens browser
 */

const { spawn } = require('child_process');
const open = require('open');
const path = require('path');
const fs = require('fs');

console.log('╔════════════════════════════════════════╗');
console.log('║   PDF to DOCX Converter v2.0          ║');
console.log('║   Starting...                          ║');
console.log('╚════════════════════════════════════════╝\n');

// Check for API key
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  No .env file found');
  console.log('   Creating empty .env file...');
  fs.writeFileSync(envPath, 'ANTHROPIC_API_KEY=\nPORT=3000\n');
  console.log('   You can configure your API key in the web UI\n');
}

// Load env vars
require('dotenv').config();

// Start server
const PORT = process.env.PORT || 3000;
const url = `http://localhost:${PORT}`;

console.log(`🚀 Starting server on port ${PORT}...`);

const serverPath = path.join(__dirname, 'server.js');
const server = spawn('node', [serverPath], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Log server output
server.stdout.on('data', (data) => {
  console.log(data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.error(data.toString().trim());
});

// Wait for server to start, then open browser
setTimeout(async () => {
  console.log(`\n✅ Server running at ${url}`);
  console.log('📂 Opening browser...\n');

  try {
    await open(url);
    console.log('✅ Browser opened successfully');
  } catch (error) {
    console.log('⚠️  Could not auto-open browser');
    console.log(`   Please open: ${url}`);
  }

  console.log('\n💡 Press Ctrl+C to stop the server\n');
}, 3000);

// Handle shutdown
const shutdown = () => {
  console.log('\n\n👋 Shutting down server...');
  server.kill();
  setTimeout(() => {
    process.exit(0);
  }, 500);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

**Step 2: Create pkg configuration**

Create `pkg-config.json`:

```json
{
  "name": "pdf-to-docx-converter",
  "version": "2.0.0",
  "bin": "launcher.js",
  "pkg": {
    "scripts": "server.js",
    "assets": [
      "frontend/**/*",
      "lib/**/*",
      "node_modules/@anthropic-ai/**/*",
      "node_modules/docx/**/*",
      "node_modules/express/**/*",
      "node_modules/multer/**/*",
      "node_modules/open/**/*",
      "node_modules/dotenv/**/*"
    ],
    "targets": [
      "node18-macos-x64",
      "node18-macos-arm64",
      "node18-win-x64",
      "node18-linux-x64"
    ],
    "outputPath": "dist"
  }
}
```

**Step 3: Add pkg as dev dependency**

Run: `npm install --save-dev pkg`

**Step 4: Add build script to package.json**

Update `package.json` scripts:

```json
{
  "scripts": {
    "start": "node scripts/start.js",
    "server": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "build": "pkg . --config pkg-config.json",
    "build:mac": "pkg . --config pkg-config.json --targets node18-macos-x64,node18-macos-arm64",
    "build:win": "pkg . --config pkg-config.json --targets node18-win-x64",
    "build:linux": "pkg . --config pkg-config.json --targets node18-linux-x64"
  }
}
```

**Step 5: Make launcher executable**

Run: `chmod +x launcher.js`

**Step 6: Test build**

Run: `npm run build:mac`

Expected: Creates `dist/pdf-to-docx-converter-macos-x64` and `dist/pdf-to-docx-converter-macos-arm64`

**Step 7: Commit**

```bash
git add launcher.js pkg-config.json package.json
chmod +x launcher.js
git add --chmod=+x launcher.js
git commit -m "feat: add packaged app launcher and build config

- launcher.js: double-click launcher for packaged app
- pkg-config.json: packaging configuration
- Build scripts for Mac, Windows, Linux
- Auto-creates .env if missing
- Pretty startup messages
- npm run build to create executables"
```

---

## Task 12: Create README

**Files:**
- Create: `README-nodejs.md`

**Step 1: Create comprehensive README**

Create `README-nodejs.md`:

```markdown
# PDF to DOCX Converter v2.0

Convert PDF documents to editable Word files using Claude AI's code generation approach.

## Features

- ✅ Convert multi-page PDFs to DOCX
- ✅ Preserve formatting, tables, and special characters
- ✅ Customizable settings (fonts, margins, formatting)
- ✅ Real-time progress tracking
- ✅ Cost tracking ($0.10-0.24 per document)
- ✅ Two deployment modes: terminal or packaged app

## Quick Start

### For Developers (Terminal)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API key:**
   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key
   ```

3. **Start server:**
   ```bash
   npm start
   ```

4. **Open browser:**
   - Automatically opens to http://localhost:3000
   - Or manually navigate to that URL

### For End Users (Packaged App)

1. **Download the app** for your platform:
   - Mac: `pdf-to-docx-converter-macos-x64` or `pdf-to-docx-converter-macos-arm64`
   - Windows: `pdf-to-docx-converter-win-x64.exe`
   - Linux: `pdf-to-docx-converter-linux-x64`

2. **Double-click to run**
   - Server starts automatically
   - Browser opens to the app

3. **Configure API key** (first time):
   - Click settings icon (gear)
   - Enter your Anthropic API key
   - Click Save

## Building Packaged Apps

```bash
# Build for all platforms
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
npm run build:linux
```

Output: `dist/` directory with executables

## Usage

1. **Upload PDF** - Click or drag to upload PDF file
2. **Configure settings** (optional) - Font, margins, model selection
3. **Convert** - Click convert and wait for progress
4. **Download** - Click download when complete

## Settings

### Model Selection
- **Haiku** - Faster, cheaper (~$0.10 per document)
- **Sonnet** - Better quality (~$0.24 per document)

### Formatting Options
- Override original formatting
- Custom fonts (Arial, Times New Roman, etc.)
- Custom margins
- Table preservation
- Page markers
- Signature replacement

### Logging
- Enable detailed logging in settings
- Shows token usage, costs, and timing in terminal
- Useful for debugging and monitoring

## Cost Estimates

| Document Size | Haiku | Sonnet |
|--------------|-------|--------|
| 3 pages | $0.05-0.10 | $0.15-0.24 |
| 10 pages | $0.15-0.25 | $0.40-0.60 |
| 50 pages | $0.50-1.00 | $1.50-2.50 |

Costs vary based on document complexity (images, tables, formatting).

## Technical Details

### Architecture
- **Backend:** Node.js + Express
- **Conversion:** Claude API generates JavaScript code using docx library
- **Execution:** Generated code runs in isolated temp directories
- **Storage:** In-memory job tracking, temporary file cleanup

### API Endpoints
- `POST /api/convert` - Upload and convert PDF
- `GET /api/jobs/:id/status` - Check conversion status
- `GET /api/download/:id` - Download converted file
- `GET /api/api-key/status` - Check API key configuration
- `POST /api/api-key` - Save API key

### File Structure
```
├── server.js                 # Main Express server
├── launcher.js              # Packaged app launcher
├── lib/
│   ├── converter.js         # Prompt builder & validator
│   ├── convertPdf.js        # Conversion engine
│   ├── jobManager.js        # Job management
│   └── validator.js         # File validation
├── frontend/                # HTML/CSS/JS UI
└── scripts/
    └── start.js             # Dev start script
```

## Development

### Running Tests
```bash
npm test
```

### Running with Auto-Reload
```bash
npm run dev
```

### Environment Variables
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3000
NODE_ENV=development
```

## Troubleshooting

### "No API key configured"
- Add API key to `.env` file or configure in settings UI

### "File too large"
- Maximum file size is 10MB
- Try splitting large PDFs

### "Conversion timeout"
- Large/complex documents may timeout
- Try using Haiku model (faster)
- Try simpler PDFs first

### "Port already in use"
- Another process is using port 3000
- Change PORT in .env file

## License

MIT

## Credits

Built with:
- [Anthropic Claude API](https://www.anthropic.com/)
- [docx library](https://docx.js.org/)
- [Express](https://expressjs.com/)
```

**Step 2: Commit**

```bash
git add README-nodejs.md
git commit -m "docs: add comprehensive README for Node.js version

- Quick start for developers and end users
- Building packaged apps
- Usage instructions
- Settings documentation
- Cost estimates
- Technical details
- Troubleshooting guide"
```

---

## Task 13: Final Testing and Cleanup

**Files:**
- Modify: `package.json` (add test script)
- Create: `.gitignore` updates

**Step 1: Run all tests**

Run: `npm test`

Expected: All tests pass

**Step 2: Test full conversion flow**

```bash
# Start server
npm start

# Upload PDF via UI
# Verify progress updates
# Verify download works
# Verify cost displayed in logs (if enabled)
```

**Step 3: Test packaged app**

```bash
# Build for your platform
npm run build:mac  # or build:win, build:linux

# Run packaged app
./dist/pdf-to-docx-converter-macos-arm64

# Verify:
# - Server starts
# - Browser opens
# - Full conversion flow works
```

**Step 4: Update .gitignore**

Ensure `.gitignore` has:

```
# Node.js
node_modules/
npm-debug.log*
.env

# Build outputs
dist/

# Temporary files
/tmp/conversion-*

# OS files
.DS_Store
Thumbs.db
```

**Step 5: Create final commit**

```bash
git add -A
git commit -m "chore: final cleanup and testing

- All tests passing
- Packaged app builds successfully
- Full conversion flow tested
- Ready for deployment"
```

---

## Task 14: Merge to Main Branch

**Files:**
- None (git operations only)

**Step 1: Ensure all changes committed**

Run: `git status`

Expected: "nothing to commit, working tree clean"

**Step 2: Push feature branch**

Run: `git push origin feature/nodejs-code-generation-redesign`

**Step 3: Switch to main branch**

Run: `cd /Users/pabloromanromanosorio/Claude-PDF-to-Word-converter && git checkout main`

**Step 4: Merge feature branch**

Run: `git merge feature/nodejs-code-generation-redesign --no-ff -m "feat: complete Node.js redesign with code generation approach

Complete rewrite from Python to Node.js using code generation approach
from official MD documentation files.

Key Changes:
- Node.js + Express backend (replaces Python FastAPI)
- Code generation approach (Claude generates docx code)
- In-memory job management (replaces SQLite)
- REST polling (replaces WebSocket)
- Two deployment modes: terminal and packaged app
- Cost: \$0.10-0.24 per document (vs \$2+ vision approach)

Breaking Changes:
- Entire backend rewritten
- API endpoints changed (port 3000 vs 8000)
- No database required
- Different conversion flow

Features Preserved:
- Full UI with all settings
- Model selection (Haiku/Sonnet)
- Formatting options
- API key management
- Cost tracking
- Logging

New Features:
- Packaged app (double-click to run)
- Auto-browser opening
- Simpler deployment
- Better cost efficiency

Documentation:
- docs/plans/2025-11-17-pdf-to-docx-converter-redesign.md (design)
- docs/plans/2025-11-17-nodejs-code-generation-implementation.md (plan)
- README-nodejs.md (usage guide)

Testing:
- Unit tests for all core functions
- Integration tests for API endpoints
- Manual testing of full flow
- Packaged app tested on Mac

References:
- README1.md
- Conversion_Workflow_Explained.md
- Generic_API_Conversion_Guide.md
- Quick_Start_Guide.md"`

**Step 5: Push to origin**

Run: `git push origin main`

**Step 6: Clean up worktree**

I'm using the finishing-a-development-branch skill:

Run: `git worktree remove .worktrees/nodejs-redesign`

Expected: Worktree removed, feature branch can be deleted if desired

---

## Summary

**Implementation complete!**

**Total Tasks:** 14
**Estimated Time:** 6-8 hours for experienced developer
**Test Coverage:** Core functions have unit tests
**Documentation:** Complete README and design docs

**Deliverables:**
1. ✅ Working Node.js server with Express
2. ✅ Full conversion engine using Claude API
3. ✅ In-memory job management
4. ✅ Updated frontend with REST polling
5. ✅ API key management
6. ✅ Packaged app launcher
7. ✅ Build scripts for all platforms
8. ✅ Comprehensive documentation
9. ✅ Unit tests for core functions
10. ✅ Ready for deployment

**Next Steps:**
- Share packaged apps with users
- Monitor conversion costs
- Gather user feedback
- Consider Phase 2 enhancements (database, WebSocket, etc.)

---

**End of Implementation Plan**
