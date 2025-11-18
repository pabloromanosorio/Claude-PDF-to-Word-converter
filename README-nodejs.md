# PDF to DOCX Converter v2.0 (Node.js)

Convert PDF documents to editable Word files using Claude AI's **docx skill** (NOT code generation).

## ✅ Fixed: Now Uses Skills API Properly

**Previous approach (BROKEN):**
- Asked Claude to generate JavaScript code
- Executed generated code (had syntax errors)
- ❌ Unreliable and error-prone

**New approach (WORKING):**
- Uses Claude's built-in **docx skill**
- Same approach as Python backend
- ✅ Reliable and proven

## Quick Start

### Installation

```bash
npm install
```

### Configuration

1. Create `.env` file:
```bash
cp .env.example .env
```

2. Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Run

```bash
npm start
```

Server starts on http://localhost:3000 and opens browser automatically.

## Features

- ✅ Convert multi-page PDFs to DOCX
- ✅ Preserve tables, formatting, special characters
- ✅ Real-time progress tracking
- ✅ Cost tracking ($0.05-0.24 per document)
- ✅ Two models: Haiku (fast/cheap) or Sonnet (better quality)
- ✅ API key management via UI
- ✅ **Uses Claude's docx skill** (same as chatbot)

## Architecture

- **Backend:** Node.js + Express
- **Conversion:** Claude API with **docx skill** (NOT code generation)
- **File Upload:** Files API (not base64)
- **Storage:** In-memory job tracking with auto-cleanup

## API Endpoints

- `POST /api/convert` - Upload and convert PDF
- `GET /api/jobs/:id/status` - Check conversion status
- `GET /api/download/:id` - Download converted file
- `GET /api/api-key/status` - Check API key configuration
- `POST /api/api-key` - Save API key

## Development

```bash
npm run dev      # Start with nodemon
npm test         # Run tests
npm run server   # Start server only (no auto-open)
```

## Cost Estimates

| Document Size | Haiku | Sonnet |
|--------------|-------|--------|
| 3 pages | $0.05-0.10 | $0.15-0.24 |
| 10 pages | $0.15-0.25 | $0.40-0.60 |

## Comparison: Node.js vs Python Backend

Both backends now work identically (same Skills API approach):

| Feature | Node.js (Port 3000) | Python (Port 8000) |
|---------|---------------------|---------------------|
| **API** | Skills API ✅ | Skills API ✅ |
| **Approach** | docx skill | docx skill |
| **Reliability** | High | High |
| **Progress** | REST polling | WebSocket real-time |
| **Storage** | In-memory | SQLite database |
| **Caching** | No | Yes (90% savings) |
| **Deployment** | Simple (single .exe) | Server-based |

**Recommendation:**
- **Node.js:** For simple desktop app deployment
- **Python:** For production with cost optimization

## Troubleshooting

### "No DOCX file generated"

**Cause:** Skills API might not be available or file extraction failed.

**Solution:**
1. Check terminal logs for detailed error
2. Enable logging in UI (Settings → Enable Logging)
3. Verify API key has access to skills
4. Try Python backend as alternative

### "ANTHROPIC_API_KEY not configured"

**Solution:**
```bash
# Add to .env
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Restart server
npm start
```

See `DEBUGGING.md` for comprehensive troubleshooting.

## License

MIT
