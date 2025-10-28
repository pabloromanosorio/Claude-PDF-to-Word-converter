# PDF to Word Converter

Convert PDFs and images to editable Word documents using Claude AI.

## ✨ Features

- 📄 Convert PDF, JPG, PNG to professional Word documents
- 🎯 80-90% visual fidelity
- 💰 Pay-as-you-go pricing (~$0.01-0.03 per page)
- ⚡ Fast conversion (10-30 seconds)
- 🔒 Secure - API key stored locally, encrypted
- 🎨 Customizable fonts, margins, formatting

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

## 📖 Documentation

- [Download Instructions](DOWNLOAD_INSTRUCTIONS.md) - For end users
- [API Key Guide](docs/API_KEY_GUIDE.md) - How to get your Anthropic API key
- [Billing Info](docs/BILLING_INFO.md) - Understanding pay-as-you-go costs
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues & solutions

## 🔧 Development

```bash
# Run tests
pytest tests/ -v

# Build installers (requires PyInstaller)
python build_installer.py
```

## 📝 License

MIT

## 💬 Support

- Issues: [GitHub Issues](issues)
- Questions: [GitHub Discussions](discussions)
