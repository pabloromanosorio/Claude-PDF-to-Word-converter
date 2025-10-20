# Changelog - Claude PDF to Word Converter

## Version 2.0 - Major Feature Update (2025-10-19)

### 🎉 New Features

#### Page Selection
- Select specific pages or ranges from PDF documents
- Syntax support: `1-5, 7, 9-12` (ranges, single pages, or combinations)
- Automatic page count detection and validation
- Creates temporary PDF with selected pages using pdf-lib

#### Prompt Modes
- **Simple Mode** (Default): Optimized for plain text documents
  - ~60% cost savings compared to Advanced mode
  - Best for letters, essays, basic reports
  - Skips complex table detection
  
- **Advanced Mode**: Full-featured conversion
  - Universal table detection
  - Complex document structure preservation
  - Best for documents with tables and forms
  
- **Custom Mode**: User-defined conversion prompts
  - Write your own instructions
  - Full control over conversion behavior
  - Saved in application settings

#### Cost Tracking
- Real-time API usage cost calculation
- Per-document cost reporting
- Total session cost tracking
- Model-specific pricing (Haiku 4.5, Sonnet 4.5, Haiku 3.5)

#### Individual Margins
- Separate controls for top, right, bottom, left margins
- Migrates old single-margin settings automatically
- DXA unit support (1440 DXA = 1 inch)

### 🐛 Bug Fixes
- Fixed Electron version compatibility (locked to v28.0.0)
- Added pdf-lib dependency for page extraction
- Fixed settings migration for old configurations
- Improved error handling for page selection

### 📚 Documentation
- Updated README with npm start instructions
- Added QUICK_START.md for fast onboarding
- Created platform-specific starter scripts
- Added troubleshooting for Mac launcher issues

### 🔧 Technical Improvements
- Added basic-prompt.txt for Simple mode
- Enhanced converter.js with page extraction logic
- Improved UI organization and layout
- Added settings validation and migration

### 📦 Dependencies
- Added: pdf-lib@^1.17.1 (page extraction)
- Locked: electron@^28.0.0 (compatibility)
- Updated: All other dependencies to latest compatible versions

---

## How to Run the App

### Mac (Recommended)
```bash
cd /path/to/pdf-converter-app
npm start
```

### Windows
Double-click `START_APP_WINDOWS.bat`

---

## Upgrade Notes

If upgrading from version 1.0:
1. Delete `node_modules` folder
2. Run `npm install`
3. Your settings and API key will be preserved
4. New features will be available immediately

---

**Total commits:** 2  
**Files changed:** 13  
**Lines added:** 1,919  
**Lines removed:** 354
