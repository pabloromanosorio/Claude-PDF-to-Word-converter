# Distribution Guide - PDF to Word Converter v2.0

This guide explains how to share the PDF to Word Converter with colleagues who need a simple, working application without any technical setup.

## For Non-Technical Users (Recommended)

### What You'll Get

A standalone application that:
- ✅ Works by double-clicking (no installation needed)
- ✅ Opens your browser automatically
- ✅ No Python or terminal knowledge required
- ✅ Just like any other desktop app

---

## Distribution Files

### Linux Users

**File:** `PDF-to-Word-Converter-Linux.tar.gz` (32MB)

**To Install:**
```bash
# 1. Extract the archive
tar -xzf PDF-to-Word-Converter-Linux.tar.gz

# 2. Navigate to the folder
cd PDF-to-Word-Converter

# 3. Run the application
./PDF-to-Word-Converter
```

**What Happens:**
1. A terminal window opens with status messages
2. Server starts automatically
3. Your browser opens to http://localhost:8000
4. You see the PDF to Word Converter interface!

**First Time Setup:**
- When the app opens, click the "Configure API Key" button
- Enter your Anthropic API key (starts with `sk-ant-`)
- Click Save
- You're ready to convert!

---

## For Windows and macOS Users

### Building for Windows

To create a Windows `.exe` file, you need to run the build on a Windows machine:

```cmd
cd v2\build
build_windows.bat
```

This creates: `dist\PDF-to-Word-Converter\PDF-to-Word-Converter.exe`

**Distribution:**
- Zip the entire `PDF-to-Word-Converter` folder
- Share the zip file
- Users: Extract and double-click `PDF-to-Word-Converter.exe`

**First Run on Windows:**
- Windows Defender may show a warning (unsigned app)
- Click "More info" → "Run anyway"
- This only happens once

### Building for macOS

To create a macOS `.app` file, you need to run the build on a Mac:

```bash
cd v2/build
./build_all.sh
```

This creates: `dist/PDF to Word Converter.app`

**Distribution:**
```bash
# Create a DMG (recommended)
cd dist
hdiutil create -volname "PDF to Word Converter" -srcfolder "PDF to Word Converter.app" -ov -format UDZO PDFConverter.dmg

# Or just zip it
zip -r PDFConverter.zip "PDF to Word Converter.app"
```

**First Run on macOS:**
- macOS Gatekeeper will block unsigned apps
- Right-click the app → Open → Confirm
- This only happens once

---

## How to Share with Colleagues

### Option 1: Native Application (Best for non-technical users)

1. **Build the application** on the target platform (Windows/Mac/Linux)
2. **Package it:**
   - Linux: Create `.tar.gz` (already done: `build/dist/PDF-to-Word-Converter-Linux.tar.gz`)
   - Windows: Zip the folder
   - macOS: Create DMG or zip the .app
3. **Upload to shared drive** (Google Drive, Dropbox, OneDrive, etc.)
4. **Send link with instructions below**

**Instructions for Recipients:**

```
PDF to Word Converter - Installation

1. Download the file from [shared link]

2. Extract/Open the file:
   - Windows: Right-click → Extract All
   - macOS: Double-click the DMG or unzip
   - Linux: tar -xzf PDF-to-Word-Converter-Linux.tar.gz

3. Run the application:
   - Windows: Double-click PDF-to-Word-Converter.exe
   - macOS: Double-click "PDF to Word Converter.app"
   - Linux: Run ./PDF-to-Word-Converter

4. Your browser will open automatically!

5. First time setup:
   - Click "Configure API Key"
   - Enter your Anthropic API key
   - Click Save

6. Start converting PDFs to Word!

Security Note:
- Windows/Mac may show a security warning on first run
- This is normal for unsigned applications
- Click "More info" → "Run anyway" (Windows)
- Or right-click → Open (macOS)
```

### Option 2: Docker (For technical users)

```
PDF to Word Converter - Docker Setup

1. Download the v2 folder
2. Create a .env file with your API key:
   echo "ANTHROPIC_API_KEY=your-key-here" > .env
3. Run: docker-compose -f docker/docker-compose.yml up
4. Open: http://localhost:8000
```

### Option 3: Python Script (For developers)

```
PDF to Word Converter - Developer Setup

1. Download the v2 folder
2. Run: ./start.sh
3. Open: http://localhost:8000
```

---

## File Sizes

- **Linux executable:** ~32MB (compressed)
- **Windows executable:** ~50-70MB (estimated)
- **macOS app:** ~60-80MB (estimated)

These are standalone packages with everything included (Python interpreter, all libraries, frontend files).

---

## Using the Application

Once running, the application provides:

### Main Features
- **Drag & Drop Upload:** Simply drag a PDF file to the upload area
- **Model Selection:** Choose between Haiku (fast, cheap) or Sonnet (best quality)
- **Real-time Progress:** Watch conversion progress live
- **Cost Estimation:** See estimated cost before converting
- **Usage Statistics:** Track your conversions and costs

### Converting a Document

1. **Open the app** (browser opens automatically)
2. **Drag a PDF file** or click to upload
3. **Choose model:**
   - Haiku: ~$0.01/page (recommended for most documents)
   - Sonnet: ~$0.02/page (best for complex layouts)
4. **Click "Convert to Word"**
5. **Watch progress** in real-time
6. **Download** the .docx file when complete!

### Advanced Settings

Click "Settings" to configure:
- Font and size (default: Arial 12pt)
- Page margins (default: 1.0" all sides)
- Page markers (adds [Page X] at page breaks)
- Signature replacement
- Table formatting options

---

## Troubleshooting

### "Port 8000 is already in use"

**Solution:** Another instance is already running. The app will open your browser to the existing instance.

### "API key not configured"

**Solution:** Click the API key prompt and enter your Anthropic API key (get one at https://console.anthropic.com/settings/keys)

### Application won't start

**Solution:**
1. Check if antivirus is blocking it
2. On Windows: Right-click → Properties → Unblock
3. Try running as administrator (Windows)
4. Check terminal output for specific error messages

### Browser doesn't open automatically

**Solution:** Manually open http://localhost:8000 in your browser

---

## For Advanced Users

### Building from Source

See `v2/build/README.md` for detailed build instructions.

### Customizing the Build

Edit `v2/build/build.spec` to:
- Change application name
- Exclude unused packages (reduce size)
- Add custom icons
- Modify console visibility

### Code Signing

For professional distribution without security warnings:

**Windows:**
- Get code signing certificate (~$100-400/year)
- Sign with: `signtool sign /f certificate.pfx PDF-to-Word-Converter.exe`

**macOS:**
- Get Apple Developer account ($99/year)
- Sign with: `codesign --deep --force --sign "Developer ID Application: Your Name" "PDF to Word Converter.app"`
- Notarize with Apple

See `v2/build/README.md` for detailed code signing instructions.

---

## Security Notes

### For Distributors

- These builds are **unsigned** (no code signing certificate)
- Windows/macOS will show security warnings on first run
- This is normal and safe for internal distribution
- For external distribution, consider code signing

### For Recipients

- The application runs a local web server (localhost only)
- Your API key is encrypted and stored locally
- No data leaves your computer except API calls to Anthropic
- All conversions happen on your machine

---

## Support

### Getting Help

1. **Check the Quick Start:** `v2/QUICKSTART.md`
2. **Read the Full Docs:** `v2/README.md`
3. **Check Build Docs:** `v2/build/README.md`
4. **Check API Docs:** http://localhost:8000/docs (when running)

### Common Questions

**Q: Do I need Python installed?**
A: No! The standalone executable includes everything.

**Q: Can I use this offline?**
A: No, it needs internet to call the Anthropic API.

**Q: How much does it cost?**
A: Depends on document size and model:
- Haiku: ~$0.01/page
- Sonnet: ~$0.02/page
- See cost estimate before converting

**Q: What file formats are supported?**
A: Input: PDF | Output: DOCX (Word format)

**Q: Can multiple people use one API key?**
A: Yes, each user configures their own API key in the app.

**Q: Is my data secure?**
A: Yes. Your API key is encrypted locally. Documents are processed by Anthropic's API (see their privacy policy).

---

## Quick Reference

### For Recipients (Non-Technical)

```
1. Download → 2. Extract → 3. Double-click → 4. Browser opens!
```

### For Distributors

```
1. Build (./build_all.sh) → 2. Package (zip/dmg) → 3. Upload → 4. Share link
```

---

## Version Information

- **Version:** 2.0
- **Build Date:** November 2025
- **Platform:** Cross-platform (Windows, macOS, Linux)
- **License:** Check repository for license details

---

**Enjoy your easy-to-use PDF to Word converter!**

No Python, no terminal, no hassle - just double-click and go! 🚀
