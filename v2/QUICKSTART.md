# Quick Start Guide - PDF to Word Converter v2.0

Get up and running in 3 minutes!

## Prerequisites

- Python 3.9 or higher
- Anthropic API key ([Get one here](https://console.anthropic.com/settings/keys))

## Installation & Setup

### Option 1: Using the Startup Script (Recommended)

```bash
cd v2
./start.sh
```

The script will:
1. Create a virtual environment
2. Install dependencies
3. Start the server at http://localhost:8000

### Option 2: Manual Setup

```bash
cd v2

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server
python backend/app.py
```

### Option 3: Using Docker

```bash
cd v2

# Create .env file with your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# Start with Docker Compose
docker-compose -f docker/docker-compose.yml up
```

## First Time Usage

1. **Open your browser** to http://localhost:8000

2. **Configure API Key** (if prompted)
   - Enter your Anthropic API key
   - Click "Save"

3. **Convert a document**
   - Drag & drop a PDF or click to upload
   - Choose model (Haiku for speed, Sonnet for quality)
   - Click "Convert to Word"
   - Watch real-time progress!
   - Download your .docx file

## Features at a Glance

✅ **Real-time progress** - See conversion status live via WebSocket
✅ **Cost estimates** - Know the cost before converting
✅ **Complex tables** - Preserves merged cells, formatting
✅ **Usage stats** - Track your conversions and costs
✅ **Smart caching** - 90% cost savings on batch conversions

## Example Conversion

```bash
# Using curl (for testing)
curl -X POST http://localhost:8000/api/convert \
  -F "file=@mydocument.pdf" \
  -F "settings={\"model\":\"claude-haiku-4-5-20251001\"}"
```

## Configuration

### Models

- **Haiku** (default): ~$0.01/page, fast, great for most documents
- **Sonnet**: ~$0.02/page, highest quality, best for complex layouts

### Settings

All settings configurable in the UI:
- Font (default: Arial 12pt)
- Margins (default: 1.0" all sides)
- Page markers (adds "[Page X]" at breaks)
- Signature replacement (replaces images with "[Signature]")
- Table formatting (preserve complex structures)

### Data Storage

- Database: `~/.pdf-converter/converter_v2.db`
- Uploads: `~/.pdf-converter/uploads/`
- API key: Encrypted in database

## Troubleshooting

### "API key not configured"
- Click the API key prompt in the UI
- Enter your Anthropic API key starting with `sk-ant-`

### "Connection refused"
- Make sure the server is running
- Check http://localhost:8000/api/health

### "File too large"
- Maximum file size: 50MB
- For larger files, use page range selection

### WebSocket not connecting
- Check browser console for errors
- Ensure no firewall blocking WebSocket connections
- Try refreshing the page

## Next Steps

- Convert your first document!
- Check out the full README.md for advanced features
- View API documentation at http://localhost:8000/docs (FastAPI auto-docs)

## Sharing with Colleagues

### Quick Share

1. **For Docker users:**
   ```bash
   # Send them the v2 folder
   # They just need to:
   cd v2
   docker-compose -f docker/docker-compose.yml up
   ```

2. **For Python users:**
   ```bash
   # Send them the v2 folder
   # They just need to:
   cd v2
   ./start.sh
   ```

### Setting up their API Key

Each user can either:
- Set `ANTHROPIC_API_KEY` in `.env` file
- Or configure it via the web UI on first launch

## Performance Tips

1. **Use Haiku by default** - It's 50% cheaper and fast enough for most docs
2. **Enable caching** - Automatically saves 90% on repeated conversions
3. **Page selection** - Convert only the pages you need
4. **Check estimates** - Cost estimate shown before converting

## Support

Need help?
- Check logs in the terminal
- Visit http://localhost:8000/api/storage for disk usage
- See full README.md for detailed documentation

---

**Happy Converting!** 🎉
