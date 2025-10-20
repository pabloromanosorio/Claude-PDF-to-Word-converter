#!/bin/bash

# Claude PDF to Word Converter - Mac Launcher
# This script ensures the app runs correctly on macOS

echo "==============================================="
echo "  Claude PDF to Word Converter"
echo "  Starting application..."
echo "==============================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "App directory: $SCRIPT_DIR"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org"
    echo "Download the LTS version and run the installer."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js detected: $NODE_VERSION"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 First-time setup: Installing dependencies..."
    echo "This may take a few minutes..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ ERROR: Failed to install dependencies!"
        echo "Please check your internet connection and try again."
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo ""
    echo "✅ Installation complete!"
    echo ""
fi

echo "🚀 Starting application..."
echo ""
echo "The app window should open shortly."
echo "You can minimize this Terminal window (but don't close it)."
echo ""

# Start the app
npm start

# If npm start exits, show message
echo ""
echo "App has closed."
read -p "Press Enter to exit..."
