# Installation Guide

## Windows 10/11

### Method 1: NSIS Installer (Recommended)

1. Download `ImageToWordConverter-Setup-1.0.0.exe` from [download page]
2. Double-click the installer
3. Click "Next" through the installation wizard
4. Choose installation directory (default: C:\Program Files\Image to Word Converter)
5. Click "Install"
6. Desktop shortcut and Start Menu entry created automatically
7. Click "Finish"
8. Launch from Desktop shortcut

### Troubleshooting Windows

**"Windows protected your PC" warning:**
1. Click "More info"
2. Click "Run anyway"

(This occurs because the app isn't code-signed. The app is safe.)

## macOS 10.13+

### Method 1: DMG (Recommended)

1. Download `ImageToWordConverter-1.0.0.dmg`
2. Double-click to mount DMG
3. Drag app icon to Applications folder
4. Eject DMG
5. Open Applications folder
6. Double-click "Image to Word Converter"
7. First launch: Welcome screen appears

### Method 2: PKG Installer

1. Download `ImageToWordConverter-1.0.0.pkg`
2. Double-click installer
3. Follow installation wizard
4. Enter admin password when prompted
5. App installed to Applications automatically
6. Launch from Launchpad

### Troubleshooting macOS

**"Unidentified developer" warning:**
1. Open System Preferences
2. Go to Security & Privacy
3. Click "Open Anyway" button
4. Confirm

**Alternative:**
```bash
xattr -d com.apple.quarantine /Applications/Image\ to\ Word\ Converter.app
```

## First Launch

Both platforms:

1. App opens with Welcome screen
2. Follow 2-step setup:
   - Get API key from Anthropic
   - Paste and save API key
3. Main interface appears
4. Ready to convert!

## Updates

The app checks for updates automatically on launch. When an update is available:

1. Notification appears
2. Click "Update Now"
3. App downloads and installs update
4. Restart app when prompted

No manual reinstallation needed!
