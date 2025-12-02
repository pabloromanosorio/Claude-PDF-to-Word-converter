#!/bin/bash

# PDF to Word Converter - Easy Launcher for Mac
# This file (.command) allows double-clicking to run in Terminal on macOS

# 1. Navigate to the directory where this script is located
# (MacOS .command files often start in the user's home directory by default)
cd "$(dirname "$0")"

echo "🚀 Starting PDF to Word Converter..."
echo "📂 Working directory: $(pwd)"

# 2. Detect Architecture and Run Appropriate Executable
ARCH=$(uname -m)

if [ "$ARCH" = "arm64" ]; then
    if [ -f "./dist/pdf-to-docx-converter-macos-arm64" ]; then
        echo "Running standalone executable (Apple Silicon)..."
        (sleep 2 && open "http://localhost:3000" 2>/dev/null) &
        ./dist/pdf-to-docx-converter-macos-arm64
        exit 0
    elif [ -f "./dist/pdf-to-docx-converter-macos-x64" ]; then
         echo "Apple Silicon detected, but ARM64 binary not found. Trying x64 via Rosetta..."
         (sleep 2 && open "http://localhost:3000" 2>/dev/null) &
         ./dist/pdf-to-docx-converter-macos-x64
         exit 0
    fi
else
    # Assume x64 (Intel)
    if [ -f "./dist/pdf-to-docx-converter-macos-x64" ]; then
        echo "Running standalone executable (Intel)..."
        (sleep 2 && open "http://localhost:3000" 2>/dev/null) &
        ./dist/pdf-to-docx-converter-macos-x64
        exit 0
    fi
fi

# 3. Fallback to Node.js if no executable found
if command -v node &> /dev/null; then
    echo "Node.js detected. Installing dependencies if needed..."
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    echo "Starting server..."
    npm start
else
    echo "❌ Error: Could not find the executable and Node.js is not installed."
    echo "Please ensure the 'dist' folder is in the same directory as this script."
    # Keep window open so user can see error
    read -n 1 -s -r -p "Press any key to exit..."
    exit 1
fi

# Keep window open if app crashes or exits
echo "App exited."
read -n 1 -s -r -p "Press any key to close..."
