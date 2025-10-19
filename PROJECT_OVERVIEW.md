# 📦 PROJECT OVERVIEW - Claude PDF to Word Converter

## ✅ Complete Application Package

This is a production-ready desktop application built with:
- **Electron** - Cross-platform desktop framework
- **React** - Modern UI library
- **Claude AI** - Advanced document understanding
- **docx.js** - Professional Word document generation

---

## 📁 Project Structure

```
pdf-converter-app/
│
├── 📄 README.md              # Complete beginner guide (READ THIS FIRST)
├── 📄 QUICK_START.md         # 5-minute setup guide
├── 📄 package.json           # Dependencies and scripts
├── 📄 .gitignore            # Git ignore rules
│
├── 🚀 START_APP.bat          # Windows launcher (double-click)
├── 🚀 START_APP.command      # Mac launcher (double-click)
│
├── ⚙️ main.js                # Electron main process
├── ⚙️ preload.js             # IPC security bridge
├── ⚙️ converter.js           # Core conversion engine
│
├── 📂 src/
│   ├── index.html           # App shell
│   ├── App.jsx              # React UI component
│   └── styles/
│       └── main.css         # Application styles
│
├── 📂 skills/               # Bundled AI documentation
│   ├── docx/
│   │   ├── SKILL.md         # DOCX creation guide
│   │   └── docx-js.md       # docx.js API reference
│   └── pdf/
│       └── SKILL.md         # PDF processing guide
│
├── 📂 prompts/
│   └── master-prompt.txt    # Enhanced conversion prompt
│
└── 📂 assets/
    └── README.txt           # Icon placeholder note
```

---

## 🔧 Technical Architecture

### Code Generation Model

The app uses an innovative "Claude writes code → Electron executes" architecture:

1. **User uploads PDF** → App reads file as base64
2. **App bundles prompt** → Master prompt + skills docs + settings
3. **Sends to Claude API** → PDF + enhanced prompt
4. **Claude generates code** → Complete Node.js script using docx.js
5. **App executes code** → Runs generated script via child_process
6. **Code creates DOCX** → Professional Word document output
7. **User gets file** → Saved in Documents/PDF-Converter-Output/

### Why This Architecture?

✅ **Leverages Claude's intelligence** - Complex parsing and understanding  
✅ **Simple app code** - Just orchestrates, doesn't parse PDFs  
✅ **High quality output** - AI understands document structure  
✅ **Easy maintenance** - Business logic in prompts, not code  
✅ **Debuggable** - Generated code can be inspected  

---

## 📋 Installation Instructions

### Prerequisites

1. **Node.js 16+**
   - Windows: Download from https://nodejs.org
   - Mac: Download from https://nodejs.org or use `brew install node`

2. **Anthropic API Key**
   - Sign up at https://console.anthropic.com
   - Create an API key
   - Add credits to account

### Quick Install

```bash
# Navigate to the app folder
cd pdf-converter-app

# Install dependencies (first time only)
npm install

# Start the app
npm start
```

**OR** just double-click the launcher:
- **Windows:** `START_APP.bat`
- **Mac:** `START_APP.command`

---

## ⚙️ Configuration

### Settings (via GUI)

**AI Models:**
- `claude-haiku-4-5` - Recommended (default)
- `claude-sonnet-4-5-20250929` - Premium quality
- `claude-3-5-haiku-20241022` - Budget option

**Document Settings:**
- Font: Arial, Times New Roman, or Calibri
- Font Size: Default 11pt
- Margins: Default 1 inch all sides

**Special Requests:**
- Replace signatures with [Signature]
- Add page markers ([Page X of the original])

### Environment Variables (Optional)

```bash
# Set API key via environment instead of GUI
export ANTHROPIC_API_KEY="sk-ant-..."

# Or on Windows:
set ANTHROPIC_API_KEY=sk-ant-...
```

---

## 🎯 Key Features

### ✅ Implemented

1. **Universal Table Detection**
   - Pattern-based recognition
   - Handles complex layouts
   - Proper Word table structure

2. **Black Text Enforcement**
   - ALL text color: #000000
   - No colored text in output
   - Professional appearance

3. **Page Markers**
   - [Page 2 of the original] format
   - Skips page 1
   - Easy reference

4. **Signature Replacement**
   - Handwritten signatures → [Signature]
   - Protects privacy
   - Clean documents

5. **Header/Footer Filtering**
   - Ignores PDF headers/footers
   - Only main content
   - No duplication

6. **No Metadata**
   - Clean DOCX properties
   - No traces
   - Professional output

7. **Batch Processing**
   - Multiple files
   - Sequential conversion
   - Progress tracking

### 🔮 Future Ready

**Translation Module** (Infrastructure in place):
- Same architecture
- Different prompt template
- Mode selector in UI
- Coming in v1.1

---

## 💰 Cost Information

### Pricing by Model

| Model | Input | Output | Est. per Page |
|-------|-------|--------|---------------|
| Haiku 4.5 ⭐ | $1/MTok | $5/MTok | $0.02 |
| Sonnet 4.5 💎 | $3/MTok | $15/MTok | $0.06 |
| Haiku 3.5 💰 | $0.80/MTok | $4/MTok | $0.016 |

### Example Costs

**100 documents @ 5 pages each = 500 pages:**
- Haiku 4.5: ~$10
- Sonnet 4.5: ~$30
- Haiku 3.5: ~$8

---

## 🐛 Development & Debugging

### Enable Developer Tools

Edit `main.js` line 24:
```javascript
// Uncomment this line:
mainWindow.webContents.openDevTools();
```

### View Generated Code

Generated code is saved to temp directory:
- **Mac:** `/tmp/pdf-converter/`
- **Windows:** `%TEMP%\pdf-converter\`

Check `[filename]_converter.js` to see what Claude generated

### Logs

Console logs appear in:
- Terminal window (where you started app)
- DevTools console (if enabled)

---

## 🔒 Security Notes

### API Key Storage
- Stored encrypted using electron-store
- Location: OS-specific app data directory
- Never transmitted except to Anthropic API

### File Privacy
- Files sent to Anthropic API via HTTPS
- Processed and deleted per Anthropic's policy
- No long-term storage on their servers

### Code Execution
- Generated code runs in isolated Node process
- Limited file system access
- Can only write to output directory

---

## 🚀 Building for Distribution

### Create Installer

```bash
npm run build
```

This creates:
- **Windows:** `.exe` installer in `dist/`
- **Mac:** `.dmg` installer in `dist/`

### Manual Distribution

1. Zip the entire `pdf-converter-app` folder
2. Share with users
3. Users extract and run launcher

---

## 📝 Customization

### Modify Master Prompt

Edit `prompts/master-prompt.txt` to:
- Change formatting rules
- Add/remove features
- Adjust table detection
- Customize output style

### Change UI

Edit `src/App.jsx` and `src/styles/main.css`

### Add Models

Edit MODEL config in:
- `src/App.jsx` (UI dropdown)
- `converter.js` (validation)

---

## ❓ Common Issues

### "Module not found"
→ Run `npm install` in app directory

### "Electron not found"
→ Delete `node_modules`, run `npm install` again

### "API key invalid"
→ Check key starts with "sk-ant-"
→ Verify credits in Anthropic account

### Code execution fails
→ Check temp directory for generated code
→ Review error messages in terminal
→ Verify docx library is installed

### Conversion is slow
→ Normal for large documents (1-3 min/page)
→ Try faster model (Haiku 4.5 vs Sonnet)
→ Check internet connection speed

---

## 📚 Documentation Links

- **Anthropic API:** https://docs.anthropic.com
- **Electron:** https://www.electronjs.org/docs
- **React:** https://react.dev
- **docx.js:** https://github.com/dolanmiu/docx

---

## 🎉 Success Checklist

Before first use, verify:

- [ ] Node.js installed (`node --version` works)
- [ ] App folder extracted completely
- [ ] Dependencies installed (ran launcher or `npm install`)
- [ ] Anthropic API key obtained
- [ ] API key configured in settings
- [ ] Test connection successful
- [ ] First PDF converted successfully

---

## 📞 Support & Troubleshooting

1. **Read README.md** - Comprehensive guide for beginners
2. **Check QUICK_START.md** - 5-minute setup instructions
3. **Review this file** - Technical details and architecture
4. **Enable DevTools** - For debugging
5. **Check generated code** - In temp directory

---

## 📜 License & Credits

**License:** MIT - Free to use, modify, distribute

**Built with:**
- Claude AI by Anthropic
- Electron Framework
- React Library
- docx.js Library
- electron-store
- @anthropic-ai/sdk

**Created:** October 2025

---

**You're all set! Start converting PDFs to Word documents with AI precision.** 🎯
