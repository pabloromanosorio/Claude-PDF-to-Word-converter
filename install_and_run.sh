#!/bin/bash

# PDF to Word Converter - Easy Launcher for Mac/Linux

echo "🚀 Starting PDF to Word Converter..."

# Detect Architecture and Run Appropriate Executable
ARCH=$(uname -m)

if [ "$ARCH" = "arm64" ]; then
    if [ -f "./dist/pdf-to-docx-converter-macos-arm64" ]; then
        echo "Running standalone executable (Apple Silicon)..."
        ./dist/pdf-to-docx-converter-macos-arm64
        exit 0
    elif [ -f "./dist/pdf-to-docx-converter-macos-x64" ]; then
         echo "Apple Silicon detected, but ARM64 binary not found. Trying x64 via Rosetta..."
         ./dist/pdf-to-docx-converter-macos-x64
         exit 0
    fi
else
    # Assume x64 (Intel)
    if [ -f "./dist/pdf-to-docx-converter-macos-x64" ]; then
        echo "Running standalone executable (Intel)..."
        ./dist/pdf-to-docx-converter-macos-x64
        exit 0
    fi
fi

# Fallback to Node.js if installed
if command -v node &> /dev/null; then
    echo "Node.js detected. Installing dependencies if needed..."
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    echo "Starting server..."
    npm start
else
    echo "❌ Error: Could not find the executable and Node.js is not installed."
    echo "Please download the 'dist' folder containing the executable."
    exit 1
fi
