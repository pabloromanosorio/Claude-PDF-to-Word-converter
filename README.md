# PDF to DOCX Converter v2.0

Convert PDF documents to editable Word files using Claude AI's **docx skill**.

## Features

- ✅ Convert multi-page PDFs to DOCX
- ✅ Preserve tables, formatting, special characters
- ✅ Real-time progress tracking
- ✅ Cost tracking ($0.05-0.24 per document)
- ✅ Two models: Haiku (fast/cheap) or Sonnet (better quality)
- ✅ API key management via UI
- ✅ Uses Claude's built-in docx skill (reliable)

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

## Architecture

**Simple Node.js backend:**
- Express server
- Claude API with Skills API (docx skill)
- Files API for upload/download
- In-memory job tracking

**How it works:**
1. Upload PDF to Claude via Files API
2. Claude uses docx skill to convert (generates & executes code remotely)
3. Download the generated DOCX file

See `HOW_SKILLS_WORK.md` for detailed explanation.

## API Endpoints

- `POST /api/convert` - Upload and convert PDF
- `GET /api/jobs/:id/status` - Check conversion status
- `GET /api/download/:id` - Download converted file
- `GET /api/api-key/status` - Check API key configuration
- `POST /api/api-key` - Save API key
- `GET /api/stats` - Usage statistics
- `GET /api/health` - Health check

## Development

```bash
npm run dev      # Start with nodemon
npm test         # Run tests
npm run server   # Start server only (no auto-open)
```

## Cost Estimates

| Document Size | Haiku 4.5 | Sonnet 4.5 |
|--------------|-----------|------------|
| 3 pages | $0.05-0.10 | $0.15-0.24 |
| 10 pages | $0.15-0.25 | $0.40-0.60 |
| 100 pages | $1.50-2.50 | $4.00-6.00 |

## Project Structure

```
├── server.js           # Express server
├── lib/
│   ├── convertPdf.js   # Conversion engine (Skills API)
│   ├── jobManager.js   # In-memory job tracking
│   └── validator.js    # Upload validation
├── frontend/
│   ├── index.html      # Web UI
│   └── js/app.js       # Frontend logic
├── package.json        # Node.js dependencies
└── .env.example        # Environment variables template
```

## Troubleshooting

### "No DOCX file generated"

**Cause:** Skills API might not be available or file extraction failed.

**Solution:**
1. Check terminal logs for detailed error
2. Enable logging in UI (Settings → Enable Logging)
3. Verify API key has access to Skills API
4. Try with a simpler PDF first

### "ANTHROPIC_API_KEY not configured"

**Solution:**
```bash
# Add to .env
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Restart server
npm start
```

See `DEBUGGING.md` for comprehensive troubleshooting.

## Documentation

- **`HOW_SKILLS_WORK.md`** - Detailed explanation of Skills API approach
- **`DEBUGGING.md`** - Troubleshooting guide
- **`NODEJS_REWRITE_SUMMARY.md`** - Why the rewrite was necessary

## What Changed in v2.0

**v1.0 (Broken):**
- Asked Claude to generate JavaScript code
- Tried to execute generated code locally
- Had syntax errors and reliability issues

**v2.0 (Working):**
- Uses Claude's Skills API properly
- Claude generates AND executes code remotely
- Reliable, secure, proven approach

The key insight: **Let Claude execute the code in its own environment** instead of trying to run it locally.

## License

MIT

## Support

For issues or questions:
1. Check terminal logs (enable logging in Settings)
2. See `DEBUGGING.md` for common issues
3. Review `HOW_SKILLS_WORK.md` to understand the architecture
