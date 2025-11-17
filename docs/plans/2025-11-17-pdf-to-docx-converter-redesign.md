# PDF to DOCX Converter - Redesign Specification

**Date:** 2025-11-17
**Approach:** Code Generation (Node.js)
**Status:** Design Complete, Ready for Implementation

---

## Executive Summary

Complete redesign of PDF to DOCX converter using the code generation approach from official MD documentation files. Migrating from Python FastAPI + direct skill usage to Node.js + generated JavaScript code execution.

**Key Benefits:**
- Predictable cost: $0.10-0.24 per document (vs $2+ for vision-based approach)
- Full feature preservation from existing UI
- Simpler architecture (no database, no WebSocket)
- Matches official Anthropic documentation patterns

---

## Design Decisions

### Core Architecture: Simplified Node.js Stack
**Chosen over:**
- Hybrid Node.js + Python (too complex)
- Node.js Full Stack with database/WebSocket (over-engineered)

**Rationale:**
- Follows MD file patterns exactly
- Single technology stack (easier deployment)
- REST polling is sufficient for local deployment
- In-memory job storage works for single-user local use

### Conversion Approach: Code Generation
**Chosen over:**
- Direct skill usage (current implementation)
- Text extraction mode (limited features)

**Rationale:**
- Matches official documentation (4 MD files)
- Consistent $0.10-0.24 cost regardless of PDF type
- Handles scanned PDFs without $2 vision costs
- More control over output formatting

### UI Features: Keep Full Features
**Chosen over:**
- Minimal UI (MD file basic example)
- Hybrid essential features only

**Rationale:**
- Users already familiar with current UI
- Settings provide flexibility for different document types
- Professional appearance important for adoption

---

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express
- **Dependencies:**
  - `@anthropic-ai/sdk` - Claude API integration
  - `docx` - Word document library (used by generated code)
  - `express` - Web server
  - `multer` - File upload handling
  - `fs` - File system operations
  - `child_process` - Code execution

### Frontend
- **Current:** HTML/CSS/JavaScript (keep as-is)
- **Updates:** API endpoint URLs only
- **No framework** - vanilla JS sufficient

### Storage
- **Temporary:** `/tmp/conversion-{uuid}/` directories
- **Persistence:** None (in-memory job Map)
- **User files:** Downloads folder (browser-controlled)

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Browser)                 │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │  Upload  │  │ Settings │  │ Progress/Download│  │
│  │   Form   │  │  Panel   │  │    Display       │  │
│  └────┬─────┘  └────┬─────┘  └────┬────────────┘  │
│       │             │              │               │
│       └─────────────┴──────────────┘               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────┐
│           Node.js Express Server (Backend)          │
│                                                      │
│  ┌───────────────────────────────────────────────┐ │
│  │  POST /api/convert                            │ │
│  │  ├─ Validate upload                           │ │
│  │  ├─ Create temp directory                     │ │
│  │  ├─ Convert PDF to base64                     │ │
│  │  ├─ Build conversion prompt                   │ │
│  │  ├─ Call Claude API ─────────────────────┐    │ │
│  │  ├─ Receive generated JavaScript code     │    │ │
│  │  ├─ Validate & clean code                 │    │ │
│  │  ├─ Execute code (node convert.js)        │    │ │
│  │  ├─ Collect output DOCX                   │    │ │
│  │  └─ Return file to user                   │    │ │
│  └────────────────────────────────────────────┼───┘ │
│                                                │     │
│  ┌───────────────────────────────────────────▼───┐ │
│  │  GET /api/jobs/:id/status (polling)          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  In-Memory Job Storage (Map)                  │ │
│  │  { jobId: { status, progress, cost, ... } }   │ │
│  └───────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ API Call
┌──────────────────────▼──────────────────────────────┐
│              Claude API (Anthropic)                  │
│  ┌─────────────────────────────────────────────┐   │
│  │  Input: PDF (base64) + Conversion Prompt    │   │
│  │  Process: Read skill files, analyze PDF     │   │
│  │  Output: JavaScript code using docx library │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Detailed Component Design

### 1. Conversion Flow

**Step-by-step process:**

```javascript
1. User uploads PDF via web form
   ↓
2. Server receives upload (multer middleware)
   ↓
3. Create unique job ID and temp directory
   /tmp/conversion-{uuid}/
   ├── input.pdf
   ├── convert.js (created later)
   └── outputs/ (created later)
   ↓
4. Convert PDF to base64 string
   ↓
5. Build conversion prompt with user settings
   ↓
6. Call Claude API
   - Model: haiku or sonnet (user choice)
   - Timeout: 120 seconds
   - Temperature: 0.3 (consistent output)
   ↓
7. Claude reads skill files:
   - /mnt/skills/public/docx/SKILL.md
   - /mnt/skills/public/docx/docx-js.md
   ↓
8. Claude analyzes PDF structure
   - Headers, body text, tables
   - Formatting (bold, italic, alignment)
   - Special characters, languages
   ↓
9. Claude generates JavaScript code
   - Uses docx library
   - Creates Document with sections
   - Builds tables, paragraphs, formatting
   - Saves to outputs/converted.docx
   ↓
10. Server receives generated code
    ↓
11. Validate & clean code
    - Remove markdown code blocks
    - Check for required imports
    - Update output paths
    ↓
12. Save code to convert.js
    ↓
13. Execute code via child process
    execSync('node convert.js', { timeout: 30000 })
    ↓
14. Code runs and creates DOCX file
    ↓
15. Read generated DOCX file
    ↓
16. Update job status to 'completed'
    ↓
17. Return DOCX to user (browser download)
    ↓
18. Schedule cleanup (5 minutes)
    - Delete temp directory
    - Remove job from Map
```

**Timing estimates:**
- Small PDF (3 pages): 15-20 seconds total
  - API call: 10-15 seconds
  - Code execution: 1-2 seconds
- Large PDF (50 pages): 40-60 seconds total
  - API call: 35-55 seconds
  - Code execution: 2-5 seconds

### 2. API Integration

**Request structure:**

```javascript
const message = await anthropic.messages.create({
  model: userSettings.model, // "claude-sonnet-4-20250514" or haiku
  max_tokens: 16000,
  temperature: 0.3,
  timeout: 120000, // 2 minutes
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdfBase64
        }
      },
      {
        type: "text",
        text: buildConversionPrompt(userSettings, workDir)
      }
    ]
  }]
});
```

**Conversion prompt template:**

```
Convert this PDF to DOCX format.

CRITICAL INSTRUCTIONS:
1. Read /mnt/skills/public/docx/SKILL.md completely (no range limits)
2. Read /mnt/skills/public/docx/docx-js.md completely (no range limits)
3. Analyze PDF structure (headers, tables, formatting)
4. Generate JavaScript using docx library that:
   - Preserves ALL content from ALL pages
   - Recreates tables with borders
   - Maintains formatting (bold, italic, alignment)
   - Uses {font} font
   - Handles special characters correctly
   - Saves to {outputPath}/outputs/converted.docx

FORMATTING REQUIREMENTS:
- Never use \n for line breaks - use separate Paragraph elements
- Tables: Set both columnWidths AND individual cell widths
- Borders: Apply to TableCell elements using BorderStyle.SINGLE
- Shading: Use ShadingType.CLEAR for headers (gray #D9D9D9)
- Margins: {margins} DXA (1440 = 1 inch)

{Additional user preferences}

Output ONLY executable JavaScript code, no explanations.
```

**Response handling:**

```javascript
// Extract generated code
let code = message.content[0].text;

// Clean up markdown
code = code.replace(/```javascript\n?/g, '').replace(/```\n?/g, '');

// Validate
if (!code.includes('Document') || !code.includes('Packer')) {
  throw new Error('Invalid code generated');
}

// Update paths
code = code.replace('/mnt/user-data/outputs/', `${workDir}/outputs/`);
```

### 3. Job Management

**In-memory storage:**

```javascript
const jobs = new Map();

// Job structure
{
  id: 'uuid',
  status: 'queued' | 'processing' | 'completed' | 'failed',
  filename: 'document.pdf',
  fileSize: 123456,
  progress: 0-100,
  currentStep: 'Uploading...',
  outputPath: '/tmp/conversion-xxx/outputs/converted.docx',
  error: null,

  // Cost tracking
  inputTokens: 50000,
  outputTokens: 5000,
  actualCost: 0.24,

  // Timestamps
  createdAt: Date.now(),
  completedAt: null
}
```

**Status endpoint:**

```javascript
app.get('/api/jobs/:jobId/status', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});
```

**Frontend polling:**

```javascript
function startPolling(jobId) {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/jobs/${jobId}/status`);
    const job = await response.json();

    // Update UI
    updateProgress(job.progress, job.currentStep);

    if (job.status === 'completed') {
      clearInterval(interval);
      showDownloadButton(jobId);
      if (job.actualCost) {
        showCost(job.actualCost);
      }
    } else if (job.status === 'failed') {
      clearInterval(interval);
      showError(job.error);
    }
  }, 2000); // Poll every 2 seconds
}
```

### 4. Error Handling

**Multi-layer validation:**

```javascript
// Layer 1: Upload validation
function validateUpload(file) {
  if (!file) throw new Error('No file uploaded');
  if (file.size > 10 * 1024 * 1024) throw new Error('File too large (max 10MB)');
  if (file.mimetype !== 'application/pdf') throw new Error('Only PDF files allowed');
  return true;
}

// Layer 2: Code generation validation
function validateGeneratedCode(code) {
  if (!code.includes('Document') || !code.includes('Packer')) {
    throw new Error('Invalid code generated - missing docx imports');
  }

  // Remove markdown if present
  code = code.replace(/```javascript\n?/g, '').replace(/```\n?/g, '');

  return code;
}

// Layer 3: Code execution error handling
try {
  execSync('node convert.js', {
    cwd: workDir,
    timeout: 30000,
    stdio: 'pipe' // Capture errors
  });
} catch (error) {
  // Log for debugging
  if (enableLogging) {
    console.error(`[${jobId}] Code execution failed:`, error.message);
    console.error(`[${jobId}] Generated code:`,
      fs.readFileSync(`${workDir}/convert.js`, 'utf8')
    );
  }
  throw new Error('Failed to generate DOCX');
}

// Layer 4: Output validation
const outputFiles = fs.readdirSync(`${workDir}/outputs`);
if (outputFiles.length === 0) {
  throw new Error('No output file created');
}
```

**User-friendly error messages:**

```javascript
const ERROR_MESSAGES = {
  'FILE_TOO_LARGE': 'File too large. Maximum size is 10MB.',
  'INVALID_TYPE': 'Only PDF files are supported.',
  'API_TIMEOUT': 'Document is too complex. Try a simpler PDF or contact support.',
  'CODE_EXECUTION_FAILED': 'Conversion failed. Please try again.',
  'NO_OUTPUT': 'Failed to generate output file. Please try again.',
  'API_ERROR': 'API error. Please check your API key and try again.'
};

function handleError(error, res, jobId) {
  const errorType = error.type || 'UNKNOWN';
  const userMessage = ERROR_MESSAGES[errorType] || 'Conversion failed. Please try again.';

  // Update job status
  if (jobId && jobs.has(jobId)) {
    const job = jobs.get(jobId);
    job.status = 'failed';
    job.error = userMessage;
  }

  // Log for debugging
  console.error(`Error [${errorType}]:`, error.message);

  // Return user-friendly message
  res.status(500).json({ error: userMessage });
}
```

### 5. Settings & Configuration

**Settings panel UI elements:**

```html
<!-- API Key Management -->
<div class="setting-group">
  <label>API Key</label>
  <input type="password" id="api-key-input" placeholder="sk-ant-..."/>
  <div class="button-group">
    <button id="test-api-key">Test Connection</button>
    <button id="save-api-key">Save</button>
  </div>
  <div id="api-key-status"></div>
</div>

<!-- Logging Toggle -->
<div class="setting-group">
  <label>
    <input type="checkbox" id="enable-logging" />
    Enable detailed logging
  </label>
  <p class="help-text">
    Shows token usage, costs, and performance in terminal.
    Useful for debugging and monitoring.
  </p>
</div>

<!-- Model Selection -->
<div class="setting-group">
  <label>Model</label>
  <select id="model-select">
    <option value="claude-haiku-4-5-20251001" selected>
      Haiku (faster, cheaper ~$0.10)
    </option>
    <option value="claude-sonnet-4-20250514">
      Sonnet (better quality ~$0.24)
    </option>
  </select>
</div>

<!-- Formatting Override -->
<div class="setting-group">
  <label>
    <input type="checkbox" id="override-formatting" />
    Override original formatting
  </label>
  <div id="format-settings" class="hidden">
    <!-- Font, margins, etc. -->
  </div>
</div>

<!-- Additional Options -->
<div class="setting-group">
  <label>
    <input type="checkbox" id="preserve-tables" checked />
    Preserve table structures
  </label>
  <label>
    <input type="checkbox" id="add-page-markers" />
    Add page markers (Page 2, Page 3, etc.)
  </label>
  <label>
    <input type="checkbox" id="replace-signatures" />
    Replace signature images with [Signature]
  </label>
</div>
```

**Settings persistence:**

```javascript
// Save to localStorage
function saveSettings() {
  const settings = {
    apiKey: document.getElementById('api-key-input').value,
    enableLogging: document.getElementById('enable-logging').checked,
    model: document.getElementById('model-select').value,
    overrideFormatting: document.getElementById('override-formatting').checked,
    font: document.getElementById('font-select')?.value || 'Arial',
    margins: {
      top: parseFloat(document.getElementById('margin-top')?.value || 1.0),
      bottom: parseFloat(document.getElementById('margin-bottom')?.value || 1.0),
      left: parseFloat(document.getElementById('margin-left')?.value || 1.0),
      right: parseFloat(document.getElementById('margin-right')?.value || 1.0)
    },
    preserveTables: document.getElementById('preserve-tables').checked,
    addPageMarkers: document.getElementById('add-page-markers').checked,
    replaceSignatures: document.getElementById('replace-signatures').checked
  };

  // Don't save API key in plain text - use better approach in production
  localStorage.setItem('converterSettings', JSON.stringify(settings));
}

// Load on page load
function loadSettings() {
  const saved = localStorage.getItem('converterSettings');
  if (saved) {
    const settings = JSON.parse(saved);
    // Populate form fields...
  }
}
```

### 6. Logging System

**Conditional logging:**

```javascript
function log(jobId, message, level = 'info') {
  const enableLogging = jobs.get(jobId)?.enableLogging || false;

  if (!enableLogging && level !== 'error') {
    return; // Skip non-error logs if disabled
  }

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${jobId}] ${message}`;

  if (level === 'error') {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
}

// Usage in conversion flow
log(jobId, `Starting conversion: ${filename} (${fileSize} bytes)`);
log(jobId, `Calling Claude API with ${model}`);
log(jobId, `API response: ${inputTokens} input, ${outputTokens} output`);
log(jobId, `Cost: $${cost.toFixed(4)}`);
log(jobId, `Executing generated code...`);
log(jobId, `✓ Conversion complete (${totalSeconds}s)`);
```

**Log output example (when enabled):**

```
[2025-11-17T10:23:15.234Z] [abc-123] Starting conversion: document.pdf (524288 bytes)
[2025-11-17T10:23:15.456Z] [abc-123] Calling Claude API with claude-haiku-4-5-20251001
[2025-11-17T10:23:28.789Z] [abc-123] API response: 51234 input, 4567 output
[2025-11-17T10:23:28.790Z] [abc-123] Cost: $0.1234
[2025-11-17T10:23:28.791Z] [abc-123] Executing generated code...
[2025-11-17T10:23:30.123Z] [abc-123] ✓ Conversion complete (14.9s)
```

### 7. Cost Tracking

**Token usage calculation:**

```javascript
// After API call
const usage = response.usage;
const inputTokens = usage.input_tokens;
const outputTokens = usage.output_tokens;

// Model pricing (per million tokens)
const MODEL_PRICING = {
  'claude-haiku-4-5-20251001': {
    input: 1.00,
    output: 5.00
  },
  'claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00
  }
};

// Calculate cost
const pricing = MODEL_PRICING[model];
const inputCost = (inputTokens / 1_000_000) * pricing.input;
const outputCost = (outputTokens / 1_000_000) * pricing.output;
const totalCost = inputCost + outputCost;

// Update job
job.inputTokens = inputTokens;
job.outputTokens = outputTokens;
job.actualCost = totalCost;
```

**Expected costs:**
- **Haiku (faster, cheaper):**
  - 3-page PDF: $0.05-0.10
  - 10-page PDF: $0.15-0.25
  - 50-page PDF: $0.50-1.00

- **Sonnet (better quality):**
  - 3-page PDF: $0.15-0.24
  - 10-page PDF: $0.40-0.60
  - 50-page PDF: $1.50-2.50

**Why cheaper than vision approach:**
- Code generation doesn't process PDF as images
- More token-efficient than vision API
- Consistent cost regardless of scanned vs native PDF

### 8. File Management

**Directory structure:**

```
/tmp/
  conversion-{uuid-1}/
    input.pdf
    convert.js
    outputs/
      converted.docx

  conversion-{uuid-2}/
    input.pdf
    convert.js
    outputs/
      converted.docx
```

**Cleanup strategy:**

```javascript
// 1. On successful conversion
setTimeout(() => {
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  jobs.delete(jobId);
}, 5 * 60 * 1000); // 5 minutes - allows time for download

// 2. On error (immediate cleanup)
catch (error) {
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  jobs.delete(jobId);
  throw error;
}

// 3. Periodic cleanup (safety net)
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    const age = now - job.createdAt;

    // Remove jobs older than 1 hour
    if (age > 60 * 60 * 1000) {
      const workDir = `/tmp/conversion-${jobId}`;
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
      jobs.delete(jobId);
    }
  }
}, 10 * 60 * 1000); // Check every 10 minutes
```

**Limits:**
- Max file size: 10MB
- Max concurrent jobs: 50
- Job retention: 1 hour
- File cleanup: 5 minutes after completion

---

## Data Flow Examples

### Example 1: Successful Conversion

```
1. User uploads "report.pdf" (3 pages, 500KB)
   ↓
2. Server creates /tmp/conversion-abc123/
   ↓
3. Convert PDF to base64 (~670KB string)
   ↓
4. Call Claude API
   - Model: claude-haiku-4-5-20251001
   - Input tokens: ~52,000 (PDF + prompt + skills)
   - Processing time: 12 seconds
   ↓
5. Claude returns JavaScript code (~4,000 tokens)
   ↓
6. Server saves code to convert.js
   ↓
7. Execute: node convert.js
   - Runtime: 1.5 seconds
   ↓
8. Output created: outputs/converted.docx
   ↓
9. Return file to browser
   - User saves to ~/Downloads/converted.docx
   ↓
10. After 5 minutes: cleanup /tmp/conversion-abc123/

Cost: $0.08 (input) + $0.02 (output) = $0.10 total
Time: 13.5 seconds total
```

### Example 2: Error Handling

```
1. User uploads "scan.jpg" (not a PDF)
   ↓
2. Validation fails: "Only PDF files allowed"
   ↓
3. Return 400 error to user
   ↓
4. No temp directory created, no API call made

Cost: $0
Time: <1 second
```

### Example 3: Large Document

```
1. User uploads "thesis.pdf" (150 pages, 8MB)
   ↓
2. Create temp directory
   ↓
3. Convert to base64 (~10MB string)
   ↓
4. Call Claude API
   - Model: claude-sonnet-4-20250514 (better quality)
   - Input tokens: ~180,000
   - Processing time: 55 seconds
   ↓
5. Claude returns code (~12,000 tokens)
   ↓
6. Execute code
   - Runtime: 4 seconds
   ↓
7. Output: 150-page DOCX file
   ↓
8. Return to user

Cost: $0.54 (input) + $0.18 (output) = $0.72 total
Time: 59 seconds total
```

---

## API Endpoints

### POST /api/convert

**Purpose:** Upload PDF and start conversion

**Request:**
```
Content-Type: multipart/form-data

Fields:
- pdf: File (required)
- settings: JSON string (optional)
  {
    model: string,
    enableLogging: boolean,
    overrideFormatting: boolean,
    font: string,
    margins: object,
    preserveTables: boolean,
    addPageMarkers: boolean,
    replaceSignatures: boolean
  }
```

**Response (Success):**
```json
{
  "jobId": "abc-123-def",
  "status": "queued",
  "message": "Conversion started"
}
```

**Response (Error):**
```json
{
  "error": "File too large. Maximum size is 10MB."
}
```

### GET /api/jobs/:jobId/status

**Purpose:** Check conversion status (for polling)

**Response (Processing):**
```json
{
  "id": "abc-123",
  "status": "processing",
  "progress": 45,
  "currentStep": "Executing generated code...",
  "filename": "report.pdf",
  "createdAt": 1700234567890
}
```

**Response (Completed):**
```json
{
  "id": "abc-123",
  "status": "completed",
  "progress": 100,
  "currentStep": "Complete",
  "filename": "report.pdf",
  "outputPath": "/tmp/conversion-abc-123/outputs/converted.docx",
  "inputTokens": 52000,
  "outputTokens": 4000,
  "actualCost": 0.10,
  "createdAt": 1700234567890,
  "completedAt": 1700234580123
}
```

**Response (Failed):**
```json
{
  "id": "abc-123",
  "status": "failed",
  "progress": 50,
  "error": "API timeout. Document is too complex.",
  "createdAt": 1700234567890
}
```

### GET /api/download/:jobId

**Purpose:** Download converted DOCX file

**Response:**
```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="converted.docx"

[Binary DOCX file data]
```

### POST /api/api-key

**Purpose:** Save API key

**Request:**
```json
{
  "apiKey": "sk-ant-..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key saved"
}
```

### POST /api/api-key/test

**Purpose:** Test API key validity

**Request:**
```json
{
  "apiKey": "sk-ant-..."
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "message": "API key is valid"
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Invalid API key"
}
```

---

## Security Considerations

### Code Execution Safety

**Isolation:**
- Each job runs in isolated temp directory
- Child process has no access to parent scope
- Timeout limits prevent infinite loops
- File system access restricted to work directory

**Validation:**
- Generated code checked for required imports
- No arbitrary code execution (only docx library)
- Output path sanitized

### API Key Storage

**Current (simple):**
- Stored in localStorage (browser)
- Sent with each request
- Works for local deployment

**Future (production):**
- Store server-side in .env file
- Use session-based authentication
- Encrypt keys at rest

### File Upload Security

**Validation:**
- File type verification (mime type + magic bytes)
- Size limits enforced (10MB max)
- No executable files allowed
- Temp directory isolation

---

## Testing Strategy

### Unit Tests

```javascript
// test/validation.test.js
describe('File Validation', () => {
  test('accepts valid PDF', () => {
    const file = { mimetype: 'application/pdf', size: 1024 };
    expect(() => validateUpload(file)).not.toThrow();
  });

  test('rejects oversized files', () => {
    const file = { mimetype: 'application/pdf', size: 11 * 1024 * 1024 };
    expect(() => validateUpload(file)).toThrow('File too large');
  });
});

describe('Code Generation', () => {
  test('validates generated code', () => {
    const validCode = 'const { Document, Packer } = require("docx");';
    expect(() => validateGeneratedCode(validCode)).not.toThrow();
  });

  test('rejects invalid code', () => {
    const invalidCode = 'console.log("hello");';
    expect(() => validateGeneratedCode(invalidCode)).toThrow('Invalid code');
  });
});
```

### Integration Tests

```javascript
// test/conversion.test.js
describe('PDF Conversion', () => {
  test('converts 3-page PDF successfully', async () => {
    const pdfBuffer = fs.readFileSync('test/fixtures/sample-3-pages.pdf');
    const response = await request(app)
      .post('/api/convert')
      .attach('pdf', pdfBuffer, 'sample.pdf')
      .expect(200);

    const { jobId } = response.body;

    // Poll for completion
    await waitForCompletion(jobId);

    // Verify output
    const status = await request(app)
      .get(`/api/jobs/${jobId}/status`)
      .expect(200);

    expect(status.body.status).toBe('completed');
    expect(status.body.actualCost).toBeGreaterThan(0);
  });
});
```

### Manual Testing Checklist

- [ ] Upload small PDF (3 pages) - verify conversion
- [ ] Upload large PDF (50 pages) - verify doesn't timeout
- [ ] Upload non-PDF file - verify error handling
- [ ] Upload oversized PDF - verify rejection
- [ ] Test with different models (Haiku, Sonnet)
- [ ] Test with different settings (fonts, margins)
- [ ] Verify logging output when enabled
- [ ] Verify cost calculations are accurate
- [ ] Test file cleanup after 5 minutes
- [ ] Test concurrent conversions (3-5 jobs)

---

## Deployment

### Local Development

```bash
# Install dependencies
npm install

# Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Start server
npm start

# Server runs on http://localhost:3000
```

### Production Deployment (Future)

**Using PM2:**
```bash
npm install -g pm2
pm2 start server.js --name pdf-converter
pm2 save
pm2 startup
```

**Using Docker:**
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

**Environment Variables:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
NODE_ENV=production
MAX_FILE_SIZE=10485760
CONVERSION_TIMEOUT=120000
```

---

## Migration Path

### From Current Implementation

**Files to keep:**
- ✅ `frontend/index.html` (update API URLs only)
- ✅ `frontend/js/app.js` (update fetch calls)
- ✅ `frontend/css/styles.css` (no changes)
- ✅ All 4 MD documentation files

**Files to remove:**
- ❌ `backend/` (entire Python directory)
- ❌ `venv/` (Python virtual environment)
- ❌ `requirements.txt`
- ❌ `database.py`, `models.py` (no longer needed)

**New files to create:**
- ✅ `server.js` (main Node.js server)
- ✅ `package.json` (dependencies)
- ✅ `.env` (API key storage)
- ✅ `README.md` (updated instructions)

**Migration steps:**
1. Create new directory structure
2. Implement Node.js server
3. Update frontend API calls
4. Test thoroughly
5. Archive old Python code
6. Deploy new version

---

## Success Metrics

### Performance
- **Target:** 95% of conversions complete in <30 seconds
- **Measure:** Track completion times, identify slow PDFs

### Cost
- **Target:** Average $0.10-0.15 per document
- **Measure:** Track actual costs, compare to estimates

### Reliability
- **Target:** 98% success rate
- **Measure:** Failed conversions / total conversions

### User Experience
- **Target:** <2 clicks from upload to download
- **Measure:** User flow analysis

---

## Future Enhancements

### Phase 2 (Optional)
- [ ] Batch processing queue
- [ ] WebSocket real-time updates
- [ ] Database persistence (SQLite)
- [ ] User authentication
- [ ] Usage analytics dashboard
- [ ] Template library for common document types

### Phase 3 (Advanced)
- [ ] Multi-language support
- [ ] PDF preview before conversion
- [ ] Side-by-side comparison (PDF vs DOCX)
- [ ] Custom formatting templates
- [ ] Webhook notifications
- [ ] API for programmatic access

---

## Appendix: Key Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Node.js over Python | Matches MD files, simpler stack | Keep Python, use hybrid |
| Code generation over direct skill | Predictable costs, better control | Keep current approach |
| In-memory jobs over database | Sufficient for local use | SQLite, PostgreSQL |
| REST polling over WebSocket | Simpler, adequate for local | Keep WebSocket |
| Keep full UI features | User familiarity | Simplify to minimal |
| Auto-cleanup after 5 min | Balance accessibility & storage | Keep files permanently |
| Optional logging | Performance + debugging flexibility | Always log everything |

---

## References

- README1.md - Documentation package overview
- Conversion_Workflow_Explained.md - Detailed process flow
- Generic_API_Conversion_Guide.md - Production implementation patterns
- Quick_Start_Guide.md - Minimal working example
- Anthropic API Documentation - Claude API reference
- docx library documentation - Word document generation

---

**End of Design Document**
