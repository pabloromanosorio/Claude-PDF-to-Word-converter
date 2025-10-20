# Claude PDF to Word Converter

Professional desktop application for converting PDF documents to Word (.docx) format using Claude AI.

---

## ⭐ Features

✅ **High-Quality Conversion** - Preserves formatting, tables, and structure  
✅ **Multiple AI Models** - Choose between Haiku 4.5 (recommended), Sonnet 4.5 (premium), or Haiku 3.5 (budget)  
✅ **Batch Processing** - Convert multiple files at once  
✅ **Smart Table Detection** - Automatically recognizes and creates proper Word tables  
✅ **Signature Replacement** - Replace handwritten signatures with [Signature] text  
✅ **Page Markers** - Adds [Page X of the original] markers for reference  
✅ **Clean Output** - Black text only, no metadata, professional formatting  

---

## 📋 Requirements

Before you start, you need:

1. **Node.js** (version 16 or higher)
2. **Anthropic API Key** (from https://console.anthropic.com)
3. **Internet connection** (for API access)

---

## 🚀 Quick Start Guide

### FOR COMPLETE BEGINNERS - READ THIS CAREFULLY

---

## STEP 1: Install Node.js

**What is Node.js?** It's free software that allows this app to run on your computer.

### Windows:
1. Go to https://nodejs.org
2. Click the big green button that says "Download" (LTS version)
3. Run the downloaded file (node-vXX.XX.X-x64.msi)
4. Click "Next" through all the screens
5. Click "Finish"
6. Restart your computer

### Mac:
1. Go to https://nodejs.org
2. Click the big green button that says "Download" (LTS version)
3. Open the downloaded file (node-vXX.XX.X.pkg)
4. Click "Continue" through all the screens
5. Enter your password when asked
6. Click "Close"
7. Restart your computer

**How to verify it worked:**
- **Windows:** Press Windows Key + R, type `cmd`, press Enter. Type: `node --version`
- **Mac:** Press Command + Space, type `terminal`, press Enter. Type: `node --version`
- You should see something like "v20.11.0"

---

## STEP 2: Get Your Anthropic API Key

**What is an API key?** Think of it like a password that lets the app use Claude AI.

1. Go to https://console.anthropic.com
2. Sign up for an account (or log in if you have one)
3. Go to "API Keys" section
4. Click "Create Key"
5. **IMPORTANT:** Copy the key immediately (it starts with "sk-ant-...")
6. Save it somewhere safe (you'll need it in Step 4)

**Cost:** You pay only for what you use. Typical costs:
- 1 page: ~$0.02
- 10 pages: ~$0.20
- 100 pages: ~$2.00

You'll add credits to your Anthropic account first.

---

## STEP 3: Download and Extract This App

1. Download the `pdf-converter-app.zip` file
2. **Windows:** Right-click the ZIP file → "Extract All..." → Choose a location
3. **Mac:** Double-click the ZIP file (it extracts automatically)
4. Remember where you extracted it!

---

## STEP 4: First-Time Setup

### Windows:

1. Open the folder where you extracted the app
2. **Double-click** `START_APP.bat`
3. You'll see a black window appear - **DON'T CLOSE IT!**
4. First time: It will say "Installing dependencies..." (takes 2-5 minutes)
5. Wait until you see the app window open
6. Click the "⚙️ Settings" button
7. Paste your API key (from Step 2)
8. Click "Test Connection" to verify it works
9. Click "Save"

### Mac:

1. Open the folder where you extracted the app
2. **Right-click** `START_APP.command` → "Open"
3. If you see a warning about "unidentified developer":
   - Click "Cancel"
   - Right-click again → "Open"
   - Click "Open" in the dialog
4. You'll see a Terminal window - **DON'T CLOSE IT!**
5. First time: It will say "Installing dependencies..." (takes 2-5 minutes)
6. Wait until you see the app window open
7. Click the "⚙️ Settings" button
8. Paste your API key (from Step 2)
9. Click "Test Connection" to verify it works
10. Click "Save"

---

## STEP 5: Convert Your First PDF

1. Click "Browse Files (PDF, JPG, PNG)"
2. Select one or more files to convert
3. Click "🚀 Convert to Word"
4. Wait (you'll see progress updates)
5. When complete, files are saved in: `Documents/PDF-Converter-Output/`

**That's it!** Your Word files are ready to use.

---

## 🎯 Using the App (Every Time After Setup)

### Windows:
Double-click `START_APP.bat` → App opens → Convert files

### Mac:
**Option 1 (Recommended):** Use Terminal
1. Open Terminal (Command + Space, type "terminal")
2. Navigate to app folder: `cd /path/to/pdf-converter-app`
3. Run: `npm start`

**Option 2:** Try START_APP.command
1. Double-click `START_APP.command`
2. If it doesn't work, use Option 1 instead

**Backup Method (Always Works):**
```bash
cd /path/to/pdf-converter-app
npm start
```

**No internet browser needed** - it's a standalone desktop app!

---

## ⚙️ Settings Explained

### AI Model (Choose One):

**Haiku 4.5 - Recommended ⭐** (Default)
- **Cost:** $1 input / $5 output per million tokens
- **Best for:** Most users - excellent quality at good price
- **When to use:** General documents, mixed content

**Sonnet 4.5 - Premium 💎**
- **Cost:** $3 input / $15 output per million tokens
- **Best for:** Complex documents with intricate tables
- **When to use:** Critical business documents, complex forms

**Haiku 3.5 - Budget 💰**
- **Cost:** $0.80 input / $4 output per million tokens
- **Best for:** Simple text-heavy documents
- **When to use:** Large batches of simple documents

### Font:
- **Arial** (Default) - Modern, professional
- **Times New Roman** - Classic, formal
- **Calibri** - Clean, readable

### Special Requests:
- **Replace signatures with [Signature]** - Recommended ✅
  - Replaces signature images with text [Signature]
  
- **Add page markers** - Recommended ✅
  - Adds "[Page 2 of the original]" at start of each page (except page 1)

---

## 📁 Where Are My Converted Files?

**Location:** `Documents/PDF-Converter-Output/`

### How to find them:

**Windows:**
1. Open File Explorer
2. Click "Documents" in the left sidebar
3. Find "PDF-Converter-Output" folder

**Mac:**
1. Open Finder
2. Click "Documents" in the left sidebar
3. Find "PDF-Converter-Output" folder

**File naming:** If your PDF was "invoice.pdf", the Word file will be "invoice.docx"

---

## ❓ Troubleshooting

### "ERROR: Node.js is not installed!"
→ Go back to Step 1 and install Node.js

### "API key test failed"
→ Check that you copied the entire key (starts with "sk-ant-...")
→ Make sure you have credits in your Anthropic account

### "Failed to install dependencies"
→ Check your internet connection
→ Try closing the app and running START_APP again

### App window doesn't open (Mac)
→ **If START_APP.command fails:** This is a known issue with some Mac configurations
→ **Solution:** Use Terminal instead:
  1. Open Terminal (Command + Space, type "terminal", press Enter)
  2. Type: `cd ` (with a space after cd)
  3. Drag the app folder into Terminal window
  4. Press Enter
  5. Type: `npm start`
  6. Press Enter
→ The app will open! Use this method every time.

### App window doesn't open (Windows)
→ Check the black/terminal window for error messages
→ Make sure Node.js is installed correctly

### Conversion takes a long time
→ This is normal! Complex documents can take 1-3 minutes per page  
→ Don't close the app while converting

### "Module not found" errors
→ Delete the `node_modules` folder  
→ Run START_APP again (it will reinstall)

---

## 🔒 Security & Privacy

✅ **Your files never leave your computer** - Except to send to Claude API  
✅ **API key stored securely** - Encrypted on your computer  
✅ **No data collection** - This app doesn't track you  
✅ **Open source** - You can review all the code  

---

## 💡 Tips for Best Results

### Document Quality:
- **Clear scans work best** - Avoid blurry or low-resolution PDFs
- **Text-based PDFs** - Better than scanned images
- **Standard fonts** - Unusual fonts may not convert perfectly

### Batch Processing:
- **Start with one file** - Test quality first
- **Group similar documents** - Keep settings consistent
- **Monitor progress** - Don't close the app during conversion

### Cost Management:
- **Use Haiku 4.5 as default** - Best quality/cost ratio
- **Switch to Haiku 3.5** - For large batches of simple docs
- **Use Sonnet 4.5 sparingly** - Only for critical complex documents

---

## 📞 Getting Help

### Common Questions:

**Q: How much does it cost?**  
A: About $0.02 per page with Haiku 4.5 (recommended). You pay Anthropic directly.

**Q: Can I convert images (JPG, PNG)?**  
A: Yes! The app handles PDF, JPG, JPEG, and PNG files.

**Q: How many files can I convert at once?**  
A: As many as you want, but they process one at a time.

**Q: Can I use this offline?**  
A: No, it needs internet to connect to Claude AI.

**Q: Is my data safe?**  
A: Yes. Files are sent to Anthropic's API (see their privacy policy), then deleted from their servers.

**Q: Can I customize the output more?**  
A: Currently: font, margins, signatures, and page markers. More options coming!

---

## 🔄 Updates

The app checks for updates automatically. When a new version is available:
1. Close the app
2. Download the new version
3. Extract it to the same location (replace old files)
4. Your settings and API key are preserved

---

## 📝 Technical Details

### For Advanced Users:

**Tech Stack:**
- Electron (desktop app framework)
- React (UI)
- Node.js (runtime)
- Anthropic API (AI processing)
- docx.js (Word document generation)

**File Structure:**
```
pdf-converter-app/
├── main.js          # Electron main process
├── preload.js       # IPC bridge
├── converter.js     # Core conversion logic
├── src/
│   ├── index.html   # App shell
│   ├── App.jsx      # React UI
│   └── styles/
├── skills/          # Bundled documentation
├── prompts/         # Master conversion prompt
└── package.json     # Dependencies
```

**Environment Variables:**
You can set `ANTHROPIC_API_KEY` instead of using the GUI

**Build from Source:**
```bash
npm install
npm start
```

---

## 📜 License

MIT License - Free to use, modify, and distribute

---

## 🙏 Credits

Built with:
- Claude AI by Anthropic
- Electron framework
- React library
- docx.js library

---

## 📬 Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Anthropic's documentation: https://docs.anthropic.com
3. Check GitHub issues (if applicable)

---

**Happy Converting! 🎉**
