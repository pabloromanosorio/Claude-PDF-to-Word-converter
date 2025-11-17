# PDF to DOCX Converter v2.0 (Node.js)

Convert PDF documents to editable Word files using Claude AI's code generation approach.

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
- ✅ Cost tracking ($0.10-0.24 per document)
- ✅ Two models: Haiku (fast/cheap) or Sonnet (better quality)
- ✅ API key management via UI

## Architecture

- **Backend:** Node.js + Express
- **Conversion:** Claude API generates JavaScript code using docx library
- **Execution:** Generated code runs in isolated temp directories
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

## Frontend Integration

**Note:** Frontend currently uses Python backend API. See `frontend/MIGRATION_NOTE.md` for required updates to use this Node.js backend.

## License

MIT
