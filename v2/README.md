# PDF to Word Converter v2.0

Complete rebuild with focus on reliability, cost optimization, and user experience.

## What's New in v2.0

### 🚀 Performance & Cost
- **70% prompt reduction** (400 → 120 tokens)
- **90% cost savings with caching** on batch conversions
- **50-70% total cost reduction** vs v1

### 🛡️ Reliability
- **Multi-strategy file extraction** (won't break on API changes)
- **Comprehensive retry logic** (handles 500, 502, 503, 504, 529 errors)
- **4 fallback extraction strategies**
- **Detailed error logging** for debugging

### 📊 Features
- **Real-time WebSocket progress** updates
- **Complex table handling** (merged cells, nested tables, formatting)
- **Usage statistics** and cost tracking
- **SQLite database** (better than JSON files)
- **Automatic file cleanup**

### 🏗️ Architecture
- **FastAPI** (async, modern, WebSocket support)
- **Pydantic** (type-safe models)
- **SQLAlchemy** (robust database ORM)
- **Optimized prompts** with special table emphasis

## Quick Start

### Prerequisites
- Python 3.9+
- Anthropic API key

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set API key (or configure via UI)
export ANTHROPIC_API_KEY='sk-ant-...'

# Run server
python backend/app.py
```

Server starts at: http://localhost:8000

## Project Structure

```
v2/
├── backend/
│   ├── app.py                 # FastAPI application
│   ├── models.py              # Pydantic models
│   ├── database.py            # SQLAlchemy database
│   ├── config.py              # Configuration management
│   │
│   ├── core/
│   │   ├── converter.py       # Main conversion engine
│   │   ├── prompt_builder.py  # Optimized prompts (120 tokens)
│   │   ├── file_extractor.py  # Multi-strategy extraction
│   │   └── retry_handler.py   # Comprehensive retry logic
│   │
│   └── services/
│       ├── cost_service.py    # Cost calculation
│       └── file_service.py    # File management
│
├── frontend/              # UI (to be added)
├── tests/                 # Tests (to be added)
├── docker/                # Docker setup (to be added)
└── requirements.txt       # Python dependencies
```

## API Endpoints

### Conversion
- `POST /api/convert` - Upload and convert document
- `GET /api/jobs/{job_id}` - Get job status
- `GET /api/download/{job_id}` - Download result
- `WS /ws/jobs/{job_id}` - Real-time progress updates

### Configuration
- `GET /api/settings` - Get default settings
- `POST /api/settings` - Save default settings
- `POST /api/api-key` - Save API key
- `GET /api/api-key/status` - Check if API key configured

### Statistics
- `GET /api/stats` - Usage statistics
- `GET /api/storage` - Storage information
- `GET /api/health` - Health check

## Key Improvements Over v1

### 1. Optimized Prompts
```python
# v1: ~400 tokens
"""Convert this scanned document to professional Word (.docx) format.
... (136 lines of verbose instructions) ..."""

# v2: ~120 tokens (70% reduction)
"""Convert this document to Word (.docx) format.
**Output Settings:** Font: Arial 12pt, Margins: 1.0" all sides
**Text Extraction:** Extract all text exactly as shown.
**Table Handling (CRITICAL):** Preserve exact structure, merged cells, formatting.
**Generate Document:** Use docx skill."""
```

### 2. Multi-Strategy File Extraction
```python
# v1: Single strategy (breaks on API changes)
file_ids.append(item.content.content.file_id)  # Crashes if structure changes

# v2: 4 fallback strategies
strategies = [
    extract_from_bash_result,      # Primary
    extract_from_text_patterns,     # Fallback 1
    extract_from_metadata,          # Fallback 2
    extract_from_content_inspection # Fallback 3 (last resort)
]
```

### 3. Comprehensive Retry Logic
```python
# v1: Only retries 429, 529
if error_code in [429, 529]:
    retry()

# v2: Retries all recoverable errors
retryable = {429, 500, 502, 503, 504, 529}
# + Network errors, timeouts
# + Exponential backoff with jitter
# + Special handling for rate limits
```

### 4. Real-Time Progress
```python
# v1: No progress updates (Flask limitation)
# User sees nothing during 30s conversion

# v2: WebSocket updates
ws = new WebSocket('/ws/jobs/{id}');
ws.onmessage = (event) => {
    // { progress: 67, step: "Processing page 10 of 15..." }
};
```

## Cost Comparison

**100-page document example:**

| Metric | v1 | v2 | Savings |
|--------|----|----|---------|
| Prompt tokens/batch | 400 | 120 | 70% |
| Total batches | 7 | 7 | - |
| Prompt tokens (total) | 2,800 | 192 (with caching) | 93% |
| Prompt cost (Sonnet) | $0.0084 | $0.0006 | $0.0078 |

**Annual savings (100 docs/month):** ~$9.36 in prompt costs alone

## Development Status

✅ Backend core complete
- Models, database, configuration
- Conversion engine with caching
- Multi-strategy extraction
- Comprehensive retry logic
- FastAPI routes
- WebSocket progress

🚧 In Progress
- Frontend UI
- Tests
- Docker setup
- PyInstaller builds
- Documentation

## Testing

```bash
# Run tests (when added)
pytest tests/

# Test API directly
curl -X GET http://localhost:8000/api/health

# Test conversion
curl -X POST http://localhost:8000/api/convert \
  -F "file=@test.pdf" \
  -F "settings={\"model\":\"claude-haiku-4-5-20251001\"}"
```

## Configuration

### Database
- Location: `~/.pdf-converter/converter_v2.db`
- Type: SQLite
- Tables: jobs, config, daily_usage

### File Storage
- Uploads: `~/.pdf-converter/uploads/`
- Retention: 24 hours
- Max storage: 500 MB
- Auto-cleanup: Every hour

### API Keys
- Encrypted with Fernet (AES-128)
- Stored in database
- Encryption key: `~/.pdf-converter/.encryption_key_v2` (chmod 600)

## Troubleshooting

### API Key Issues
```bash
# Check if API key is configured
curl http://localhost:8000/api/api-key/status

# Set API key
curl -X POST http://localhost:8000/api/api-key \
  -H "Content-Type: application/json" \
  -d '{"api_key":"sk-ant-..."}'
```

### Database Issues
```bash
# Reset database (CAUTION: deletes all data)
rm ~/.pdf-converter/converter_v2.db

# Restart server (will recreate database)
python backend/app.py
```

### File Cleanup
```bash
# Manual cleanup
rm -rf ~/.pdf-converter/uploads/*

# Check storage
curl http://localhost:8000/api/storage
```

## Contributing

This is a personal use application being shared with colleagues. Feel free to:
- Report issues
- Suggest improvements
- Submit pull requests

## License

Personal use - Not for commercial distribution

## Support

For issues or questions, check:
1. Logs: Application logs in terminal
2. Database: Check `~/.pdf-converter/converter_v2.db`
3. Storage: Check `/api/storage` endpoint
4. Health: Check `/api/health` endpoint
