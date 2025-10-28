# PDF to Word Converter

Convert PDFs and images to editable Word documents using Claude AI.

## ✨ Features

### Core Conversion
- 📄 Convert PDF, JPG, PNG to professional Word documents
- 🎯 80-90% visual fidelity using Claude Vision API
- ⚡ Fast conversion (10-30 seconds per document)
- 📚 Batch processing for large documents (automatic for >90 pages)
- 🔒 Secure - API key stored locally with encryption

### Smart Features
- 📑 **Page Selection**: Convert specific pages or ranges (e.g., "1-5, 7, 9-12")
- ✍️ **Custom Prompts**: Edit conversion prompts for specialized needs
- 💰 **Cost Estimation**: See estimated cost before conversion
- 💵 **Cost Tracking**: View actual API costs after conversion
- 🔄 **Auto-Retry**: Exponential backoff for API overload (3 retries)
- 🎨 **Formatting Control**: Customizable fonts, margins, signatures, page markers

### Model Options
- ⚡ **Haiku 4.5**: Fastest, ~$0.01/page
- 🎯 **Sonnet 4.5**: Best quality, ~$0.02/page

## 🚀 Quick Start

### For End Users (Easiest)

**Download the installer:**
- **Windows:** [Download .exe](releases/latest) (coming soon)
- **Mac:** [Download .dmg](releases/latest) (coming soon)

Double-click to install, no technical knowledge required!

See [DOWNLOAD_INSTRUCTIONS.md](DOWNLOAD_INSTRUCTIONS.md) for detailed steps.

### For Developers

**Requirements:** Python 3.10+

```bash
# Clone repository
git clone https://github.com/yourname/pdf-converter.git
cd pdf-converter

# Install dependencies
pip install -r requirements.txt

# Run app
python app.py
```

Browser opens automatically to http://localhost:5000

## 💰 Pricing

- **Per page:** ~$0.01-0.03
- **1-page letter:** ~$0.02
- **10-page contract:** ~$0.20
- **100-page book:** ~$2.00

No subscription. Pay only for what you convert through Anthropic.

## 🏗️ Architecture

This converter uses:
- **Claude Vision API**: For OCR and document understanding
- **Built-in docx Skill**: For Word document generation
- **Flask Backend**: Local web server (Python)
- **Browser UI**: Modern web interface

**Key Technologies:**
- `anthropic` SDK for API calls
- `python-docx` for document merging
- `pypdf` for page extraction
- `flask` for web server

## 📖 Documentation

- [API Reference](API_REFERENCE.md) - Complete API documentation
- [Download Instructions](DOWNLOAD_INSTRUCTIONS.md) - For end users
- [Testing Guide](test_converter.py) - Integration tests
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues & solutions

## 🔧 Development

```bash
# Install development dependencies
pip install -r requirements.txt

# Run tests
pytest test_converter.py -v

# Run app in development mode
python app.py

# Test with sample files
# (Place PDFs/images in test folder and convert via UI)
```

### Project Structure
```
pdf-converter-app-clean/
├── app.py                  # Flask web server
├── converter.py            # Core conversion logic (Vision + Skills)
├── config_manager.py       # Settings & API key management
├── cost_calculator.py      # Cost estimation & tracking
├── requirements.txt        # Python dependencies
├── static/                 # Frontend files
│   ├── index.html          # UI
│   ├── app.js              # Frontend logic
│   └── style.css           # Styling
└── test_converter.py       # Integration tests
```

## 📝 License

MIT

## 💬 Support

- Issues: [GitHub Issues](issues)
- Questions: [GitHub Discussions](discussions)
