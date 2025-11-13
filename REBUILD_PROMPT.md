# PDF to Word Converter - Complete Rebuild Specification

## Executive Summary

Rebuild a production-grade PDF/Image to Word converter that uses Claude's Vision API and docx skill efficiently, with focus on **minimal token usage**, **consistent API skill usage**, and **robust error handling**.

---

## Core Requirements

### 1. Primary Function
Convert PDF and image files (PDF, JPG, PNG) to editable Word (.docx) documents using:
- **Claude Vision API** for document understanding
- **Built-in `docx` skill** (via Anthropic Skills API)
- **Efficient token usage** through prompt optimization and caching

### 2. Critical Success Factors
1. **Minimize token usage** - Every token costs money
2. **Consistent skill usage** - Reliable docx skill integration
3. **Preserve conversion quality** - 80-90% visual fidelity
4. **Robust error handling** - Graceful degradation, clear error messages
5. **Simple architecture** - Easy to maintain and debug

---

## Technical Architecture

### Stack
**Backend:**
- Python 3.9+ (lightweight, native async support)
- FastAPI (modern, async, better than Flask for this use case)
- Anthropic Python SDK (latest version)
- pypdf for PDF handling
- python-docx for DOCX manipulation (merging only)

**Frontend:**
- Single-page vanilla JavaScript application
- Tailwind CSS for styling (CDN, no build step)
- Native Fetch API (no libraries needed)

**Data Storage:**
- SQLite database for configuration and usage tracking
- Encrypted API keys using cryptography.fernet
- File-based uploads with automatic cleanup

### Why FastAPI over Flask?
- Native async/await support (important for long-running conversions)
- Better WebSocket support for real-time progress updates
- Automatic OpenAPI documentation
- Better type validation with Pydantic models
- More performant for our use case

---

## Token Optimization Strategy

### 1. **Optimized Prompts**
**Current Problem:** Verbose 136-line prompt wastes tokens

**Solution:** Concise, effective prompts
```
Convert this document to Word format (.docx).

Settings: {font} {size}pt, {margin}" margins
Output: {filename}.docx

Extract all text exactly as shown. Preserve layout, tables, lists, and formatting.
{if replaceSignatures: Replace signature images with "[Signature]"}
{if addPageMarkers: Add "[Page X]" after page breaks}
{customInstructions}

Use the docx skill to create the Word document.
```

**Token Savings:** ~70% reduction (from ~400 tokens to ~120 tokens per request)

### 2. **Prompt Caching**
Use Anthropic's Prompt Caching feature:
- Cache the base conversion instructions
- Only variable parts: filename, specific settings
- **Savings:** 90% cost reduction on cached portions for repeated conversions

Implementation:
```python
messages = [{
    'role': 'user',
    'content': [
        {
            'type': 'text',
            'text': BASE_INSTRUCTIONS,  # Cached
            'cache_control': {'type': 'ephemeral'}
        },
        {'type': 'document', 'source': {...}},
        {'type': 'text', 'text': f'Filename: {name}'}  # Variable
    ]
}]
```

### 3. **Smart Batching**
**Current:** 15 pages per batch, each is independent API call

**Improved:**
- 20-30 pages per batch (fewer API calls)
- Reuse conversation context for batches (caching benefits)
- Parallel processing where possible

### 4. **Model Selection Intelligence**
- Default to **Haiku 4.5** (5x cheaper than Sonnet)
- Auto-upgrade to Sonnet only for complex documents:
  - Heavy tables/formatting
  - Poor scan quality
  - User explicitly requests higher quality

---

## Robust Error Handling

### 1. **API Response Parsing**
**Current Problem:** Fragile nested response parsing

**Solution:** Defensive extraction with fallbacks
```python
def extract_file_ids(response) -> List[str]:
    """Extract file IDs with multiple fallback strategies"""
    file_ids = []

    # Strategy 1: Bash execution results
    for block in response.content:
        if block.type == 'bash_code_execution_tool_result':
            if hasattr(block, 'content') and hasattr(block.content, 'content'):
                for file_obj in block.content.content:
                    if hasattr(file_obj, 'file_id'):
                        file_ids.append(file_obj.file_id)

    # Strategy 2: Text content file ID patterns
    if not file_ids:
        for block in response.content:
            if block.type == 'text':
                # Extract file IDs from text using regex
                matches = re.findall(r'file-[a-zA-Z0-9]+', block.text)
                file_ids.extend(matches)

    # Strategy 3: Check response metadata
    if not file_ids and hasattr(response, 'files'):
        file_ids = [f.id for f in response.files]

    if not file_ids:
        raise ConversionError(
            "No file generated. Response structure may have changed.",
            details={'response_types': [b.type for b in response.content]}
        )

    return file_ids
```

### 2. **Comprehensive Retry Logic**
```python
RETRYABLE_ERRORS = {
    429: 'Rate limit - exponential backoff',
    529: 'Service overload - exponential backoff',
    500: 'Server error - retry',
    503: 'Service unavailable - retry'
}

@retry(
    max_attempts=5,
    backoff_strategy='exponential',
    initial_delay=2,
    max_delay=60,
    jitter=True
)
async def api_call_with_retry(func, **kwargs):
    """Enhanced retry with circuit breaker pattern"""
    # Implementation
```

### 3. **Structured Error Types**
```python
class ConversionError(Exception):
    """Base conversion error"""
    def __init__(self, message, details=None, retryable=False):
        self.message = message
        self.details = details or {}
        self.retryable = retryable

class SkillExecutionError(ConversionError):
    """Skill failed to generate document"""

class APIQuotaError(ConversionError):
    """API quota exceeded"""

class FileProcessingError(ConversionError):
    """Failed to process uploaded file"""
```

---

## Data Models (Pydantic)

### Settings Model
```python
from pydantic import BaseModel, validator
from typing import Optional, Literal

class ConversionSettings(BaseModel):
    font: str = 'Arial'
    font_size: int = 12
    margin: float = 1.0
    replace_signatures: bool = True
    add_page_markers: bool = True
    model: Literal['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929']
    custom_instructions: Optional[str] = None

    @validator('font_size')
    def validate_font_size(cls, v):
        if not 8 <= v <= 72:
            raise ValueError('Font size must be between 8 and 72')
        return v

    @validator('margin')
    def validate_margin(cls, v):
        if not 0.1 <= v <= 3.0:
            raise ValueError('Margin must be between 0.1 and 3.0 inches')
        return v
```

### Conversion Job Model
```python
class ConversionJob(BaseModel):
    id: str
    filename: str
    file_size: int
    page_count: int
    page_range: Optional[str]
    settings: ConversionSettings
    status: Literal['queued', 'processing', 'completed', 'failed']
    progress: int  # 0-100
    estimated_cost: Optional[float]
    actual_cost: Optional[float]
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
```

---

## API Endpoints (FastAPI)

### Core Endpoints
```python
# Health & Configuration
GET  /api/health          # Health check
GET  /api/config          # Get all config (settings + has_api_key status)
POST /api/config          # Update config

# API Key
POST /api/api-key         # Save encrypted API key
GET  /api/api-key/status  # Check if configured

# Conversion
POST /api/convert         # Upload and convert (returns job_id)
GET  /api/jobs/{job_id}   # Get job status
WS   /api/jobs/{job_id}/progress  # Real-time progress (WebSocket)
GET  /api/download/{job_id}       # Download result

# Utilities
POST /api/estimate        # Estimate cost before conversion
POST /api/validate-file   # Validate file before upload
GET  /api/usage-stats     # Get usage statistics
```

### Real-time Progress with WebSockets
```python
@app.websocket("/api/jobs/{job_id}/progress")
async def job_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()

    while True:
        job = get_job_status(job_id)
        await websocket.send_json({
            'status': job.status,
            'progress': job.progress,
            'message': job.current_step
        })

        if job.status in ['completed', 'failed']:
            break

        await asyncio.sleep(1)
```

---

## File Management Strategy

### 1. **Automatic Cleanup**
```python
class FileManager:
    UPLOAD_DIR = Path.home() / '.pdf-converter' / 'uploads'
    MAX_FILE_AGE_HOURS = 24
    MAX_STORAGE_MB = 500

    async def cleanup_old_files(self):
        """Remove files older than 24 hours"""
        cutoff = datetime.now() - timedelta(hours=self.MAX_FILE_AGE_HOURS)

        for file in self.UPLOAD_DIR.glob('*'):
            if file.stat().st_mtime < cutoff.timestamp():
                file.unlink()

    async def enforce_storage_limit(self):
        """Remove oldest files if storage exceeds limit"""
        # Implementation
```

### 2. **Temporary File Context Manager**
```python
@contextmanager
def temporary_pdf(pages: List[Page], suffix: str = ''):
    """Auto-cleanup temp file"""
    temp_path = None
    try:
        temp_path = create_temp_pdf(pages, suffix)
        yield temp_path
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
```

---

## Database Schema (SQLite)

### Tables
```sql
-- Configuration
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    encrypted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversion Jobs
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER NOT NULL,
    page_range TEXT,
    settings JSON NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    estimated_cost REAL,
    actual_cost REAL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Usage Statistics (for analytics)
CREATE TABLE daily_usage (
    date DATE PRIMARY KEY,
    total_conversions INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);
```

---

## Enhanced Features

### 1. **Conversion Queue**
For multiple files or large documents:
```python
class ConversionQueue:
    """Process conversions with concurrency limits"""
    MAX_CONCURRENT = 2  # Avoid rate limits

    async def add_job(self, job: ConversionJob):
        """Add to queue"""

    async def process_queue(self):
        """Process jobs with concurrency limit"""
```

### 2. **Cost Tracking & Alerts**
```python
class CostMonitor:
    """Track and alert on API costs"""

    def check_daily_limit(self, estimated_cost: float) -> bool:
        """Check if conversion would exceed daily limit"""
        daily_total = get_today_cost()
        if daily_total + estimated_cost > DAILY_LIMIT:
            raise CostLimitError(f"Daily limit exceeded: ${daily_total:.2f}")
        return True
```

### 3. **Usage Analytics**
- Daily/weekly/monthly statistics
- Cost trends
- Average cost per page
- Most common settings

---

## Frontend Implementation

### Single-Page Application Structure
```
/static
  /js
    - app.js           # Main application
    - api.js           # API client
    - components.js    # UI components
    - utils.js         # Helpers
  /css
    - (using Tailwind CDN)
  index.html
```

### Key Components

**1. File Upload with Progress**
```javascript
class FileUploader {
    constructor() {
        this.dropZone = document.getElementById('drop-zone');
        this.setupDragDrop();
    }

    async upload(file) {
        // Create job
        const job = await api.createConversionJob(file);

        // Connect to progress WebSocket
        const ws = new WebSocket(`ws://localhost:8000/api/jobs/${job.id}/progress`);

        ws.onmessage = (event) => {
            const progress = JSON.parse(event.data);
            this.updateProgress(progress);
        };
    }
}
```

**2. Settings Panel**
```javascript
class SettingsPanel {
    constructor() {
        this.loadSettings();
        this.setupAutoSave();
    }

    async loadSettings() {
        const config = await api.getConfig();
        this.render(config.settings);
    }

    setupAutoSave() {
        // Debounced auto-save on change
        this.form.addEventListener('input',
            debounce(() => this.save(), 1000)
        );
    }
}
```

**3. Cost Estimator**
```javascript
class CostEstimator {
    async estimate(file, settings) {
        const estimate = await api.estimateCost(file, settings);
        this.render(estimate);
    }
}
```

---

## Error Recovery Strategies

### 1. **Partial Results Recovery**
If batch processing fails midway:
```python
async def convert_with_recovery(job: ConversionJob):
    completed_batches = []

    try:
        for batch in batches:
            result = await convert_batch(batch)
            completed_batches.append(result)

            # Save checkpoint
            save_checkpoint(job.id, completed_batches)

    except Exception as e:
        # Merge completed batches
        if completed_batches:
            partial_result = merge_batches(completed_batches)
            save_partial_result(job.id, partial_result)
            raise PartialConversionError(
                "Conversion partially completed",
                completed_pages=len(completed_batches) * 15,
                total_pages=job.page_count
            )
        raise
```

### 2. **Graceful Degradation**
```python
async def convert_document(file_path: str, settings: ConversionSettings):
    try:
        # Try with user's selected model
        return await convert_with_model(file_path, settings.model)

    except QuotaExceededError:
        # Suggest switching to cheaper model
        if settings.model == 'sonnet':
            logger.warning("Quota exceeded, suggesting Haiku")
            raise ConversionError(
                "Quota exceeded. Try using Haiku model (5x cheaper)?",
                retryable=True,
                suggestion='use_haiku'
            )

    except SkillExecutionError as e:
        # Retry with different skill version
        if 'latest' in settings.skill_version:
            logger.warning("Retrying with stable skill version")
            return await convert_with_skill_version(file_path, 'stable')
```

---

## Testing Strategy

### 1. **Unit Tests**
```python
# Test prompt optimization
def test_prompt_token_count():
    prompt = build_optimized_prompt(settings, 'test.pdf')
    token_count = count_tokens(prompt)
    assert token_count < 150, "Prompt too long"

# Test error extraction
def test_extract_file_ids_fallback():
    response = MockResponse(malformed=True)
    file_ids = extract_file_ids(response)
    assert len(file_ids) > 0
```

### 2. **Integration Tests**
```python
@pytest.mark.integration
async def test_full_conversion_flow():
    # Upload file
    job = await api.create_job('test.pdf')

    # Wait for completion
    result = await wait_for_completion(job.id, timeout=60)

    assert result.status == 'completed'
    assert result.actual_cost < result.estimated_cost * 1.2
```

### 3. **Performance Tests**
```python
def test_token_usage_optimization():
    """Ensure we're not wasting tokens"""
    results = []

    for _ in range(10):
        result = convert_document('test.pdf', settings)
        results.append(result.input_tokens)

    avg_tokens = sum(results) / len(results)

    # With caching, should be very low after first call
    assert results[-1] < results[0] * 0.2, "Caching not working"
```

---

## Deployment & Operations

### 1. **Startup Script (Cross-Platform)**
```python
# start.py
import subprocess
import sys
import platform
from pathlib import Path

def main():
    # Check Python version
    if sys.version_info < (3, 9):
        print("❌ Python 3.9+ required")
        sys.exit(1)

    # Create venv if needed
    venv_dir = Path('.venv')
    if not venv_dir.exists():
        print("📦 Creating virtual environment...")
        subprocess.run([sys.executable, '-m', 'venv', '.venv'])

    # Activate and install
    pip = venv_dir / ('Scripts' if platform.system() == 'Windows' else 'bin') / 'pip'
    subprocess.run([str(pip), 'install', '-r', 'requirements.txt'])

    # Start app
    python = venv_dir / ('Scripts' if platform.system() == 'Windows' else 'bin') / 'python'
    subprocess.run([str(python), 'app.py'])

if __name__ == '__main__':
    main()
```

### 2. **Monitoring & Logging**
```python
import structlog

logger = structlog.get_logger()

# Structured logging
logger.info(
    "conversion_started",
    job_id=job.id,
    filename=job.filename,
    page_count=job.page_count,
    model=settings.model
)

logger.info(
    "conversion_completed",
    job_id=job.id,
    duration_seconds=duration,
    actual_cost=cost,
    input_tokens=tokens.input,
    output_tokens=tokens.output,
    cost_per_page=cost / page_count
)
```

### 3. **Configuration Management**
```python
from pydantic import BaseSettings

class AppConfig(BaseSettings):
    # App settings
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000

    # Limits
    max_file_size_mb: int = 50
    max_concurrent_jobs: int = 2
    daily_cost_limit: float = 10.0

    # Cleanup
    file_retention_hours: int = 24
    auto_cleanup_enabled: bool = True

    class Config:
        env_file = '.env'
```

---

## Migration from Current Version

### Migration Script
```python
# migrate.py
from pathlib import Path
import json
import shutil
from old_config_manager import ConfigManager as OldConfig
from new_database import Database

def migrate():
    old_config = OldConfig()
    db = Database()

    # Migrate API key
    api_key = old_config.get_api_key()
    if api_key:
        db.save_encrypted_config('api_key', api_key)

    # Migrate settings
    settings = old_config.get_settings()
    db.save_config('settings', settings)

    # Backup old files
    old_dir = Path.home() / '.pdf-converter'
    backup_dir = old_dir.parent / '.pdf-converter.backup'
    shutil.move(old_dir, backup_dir)

    print("✅ Migration complete!")
    print(f"📁 Old files backed up to: {backup_dir}")

if __name__ == '__main__':
    migrate()
```

---

## Performance Benchmarks

### Target Metrics
| Metric | Target | Current | Improvement |
|--------|--------|---------|-------------|
| Avg tokens/page (input) | <150 | ~400 | 62% reduction |
| Avg tokens/page (output) | ~2500 | ~3000 | 17% reduction |
| Cost per page (Haiku) | $0.008 | $0.01 | 20% savings |
| Conversion time (10 pages) | <25s | 30s | 17% faster |
| Error rate | <2% | ~5% | 60% improvement |
| Cache hit rate | >80% | 0% | New feature |

---

## Security Considerations

### 1. **API Key Security**
- Fernet encryption (AES-128)
- Key stored with 0o600 permissions
- Never logged or exposed in errors
- Encrypted at rest in database

### 2. **File Upload Security**
- Validate file type via magic bytes (not just extension)
- Scan for malware (optional: ClamAV integration)
- Size limits enforced
- Path traversal prevention
- Automatic cleanup

### 3. **Rate Limiting**
```python
from slowapi import Limiter

limiter = Limiter(key_func=lambda: 'global')

@app.post("/api/convert")
@limiter.limit("10/minute")
async def convert_endpoint():
    ...
```

---

## Future Enhancements

### Phase 2 Features
1. **Batch file upload** - Convert multiple files at once
2. **OCR quality options** - Low/Medium/High quality modes
3. **Output format options** - PDF, RTF, HTML in addition to DOCX
4. **Cloud storage integration** - Save directly to Google Drive, Dropbox
5. **API for programmatic access** - Allow other apps to use the converter

### Phase 3 Features
1. **Multi-language support** - UI internationalization
2. **Team/organization accounts** - Shared API keys, usage tracking
3. **Webhook notifications** - Alert when conversion completes
4. **Advanced formatting** - Custom styles, templates
5. **Document comparison** - Visual diff of original vs converted

---

## Success Criteria

### Must Have (MVP)
- ✅ Convert PDF/images to Word with 80%+ fidelity
- ✅ Token usage reduced by 50%+ vs current implementation
- ✅ Cost per page: <$0.01 (Haiku), <$0.02 (Sonnet)
- ✅ Error rate <2%
- ✅ Real-time progress updates
- ✅ Auto-cleanup of old files
- ✅ Encrypted API key storage
- ✅ Usage statistics and cost tracking

### Should Have
- ✅ Prompt caching (90% cost reduction on cache hits)
- ✅ Batch processing with recovery
- ✅ WebSocket progress updates
- ✅ Smart model selection
- ✅ Comprehensive error handling
- ✅ SQLite database for persistence

### Nice to Have
- Circuit breaker pattern for API failures
- Cost limit enforcement
- Conversion queue with priority
- Export usage reports (CSV)
- Dark mode UI

---

## Development Timeline

### Week 1: Backend Foundation
- Day 1-2: FastAPI setup, database schema, models
- Day 3-4: Core conversion logic with optimized prompts
- Day 5-7: Error handling, retry logic, file management

### Week 2: Frontend & Integration
- Day 1-3: Frontend UI (vanilla JS + Tailwind)
- Day 4-5: WebSocket integration, real-time updates
- Day 6-7: Testing, bug fixes

### Week 3: Polish & Deploy
- Day 1-2: Performance optimization, caching
- Day 3-4: Documentation, migration script
- Day 5-6: End-to-end testing
- Day 7: Release prep, deployment scripts

---

## Conclusion

This rebuild focuses on the three critical requirements:

1. **Skills API Consistency**: Robust, defensive extraction of file IDs with multiple fallback strategies
2. **Token Minimization**: 50-70% reduction through prompt optimization and caching
3. **Quality Preservation**: Maintains 80-90% fidelity while reducing costs

The architecture is simpler, more maintainable, and significantly more robust than the current implementation. By switching to FastAPI, adding real-time progress, implementing prompt caching, and building comprehensive error handling, this version will provide a production-ready experience with minimal operational issues.

**Estimated ROI:**
- **50% cost reduction** per conversion (through token optimization)
- **60% fewer errors** (through robust error handling)
- **Better user experience** (real-time progress, faster responses)
- **Easier maintenance** (cleaner code, better architecture)
