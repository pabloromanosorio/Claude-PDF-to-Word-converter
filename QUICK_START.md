# Quick Start Guide - Claude PDF to Word Converter

## 🚀 How to Run the App

### Mac Users

**Method 1: Terminal (Recommended - Always Works)**
1. Open Terminal (Command + Space, type "terminal")
2. Navigate to the app folder:
   ```bash
   cd /path/to/pdf-converter-app
   ```
   *Tip: Type `cd ` (with space), then drag the app folder into Terminal*
3. Run the app:
   ```bash
   npm start
   ```
4. The app window will open!

**Method 2: Double-Click Script (May Not Work on All Systems)**
1. Double-click `START_APP_MAC.command`
2. If you see a security warning:
   - Right-click the file
   - Select "Open"
   - Click "Open" in the dialog
3. If this doesn't work, use Method 1

---

### Windows Users

**Method 1: Double-Click (Easiest)**
1. Double-click `START_APP_WINDOWS.bat`
2. The app will install dependencies (first time only)
3. App window opens automatically!

**Method 2: Command Prompt (If Method 1 Fails)**
1. Press Windows Key + R
2. Type `cmd` and press Enter
3. Navigate to app folder:
   ```
   cd C:\path\to\pdf-converter-app
   ```
4. Run:
   ```
   npm start
   ```

---

## ⚙️ First-Time Setup

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org
   - Install the LTS version
   - Restart your computer

2. **Get Anthropic API Key**
   - Go to: https://console.anthropic.com
   - Sign up / Log in
   - Create an API key
   - Copy it (starts with `sk-ant-...`)

3. **Configure the App**
   - Run the app using methods above
   - Click "⚙️ Settings"
   - Paste your API key
   - Click "Test Connection"
   - Click "Save"

---

## 📁 Output Location

Your converted Word files are saved to:
- **Windows:** `C:\Users\YourName\Documents\PDF-Converter-Output\`
- **Mac:** `/Users/YourName/Documents/PDF-Converter-Output/`

---

## 💡 New Features

### Page Selection
Select specific pages from PDFs:
- Single pages: `1, 5, 10`
- Ranges: `1-5`
- Combined: `1-5, 7, 9-12`

### Prompt Modes
- **Simple Mode**: Fast, optimized for plain text (~60% cost savings)
- **Advanced Mode**: Best quality, handles complex tables
- **Custom Mode**: Write your own conversion instructions

### Cost Tracking
See real-time API costs for each conversion!

### Individual Margins
Set top, right, bottom, and left margins separately.

---

## ❓ Troubleshooting

### Mac: "App window doesn't open"
→ Use Terminal method (Method 1) - it always works!

### Windows: "Node.js is not installed"
→ Download from https://nodejs.org and install

### "Module not found" error
→ Delete the `node_modules` folder and run the app again

### App opens but conversion fails
→ Check your API key in Settings
→ Make sure you have credits in your Anthropic account

---

## 📞 Need Help?

See the full [README.md](README.md) for detailed troubleshooting and documentation.

---

**Happy Converting! 🎉**
