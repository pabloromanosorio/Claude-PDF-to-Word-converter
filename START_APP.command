#!/bin/bash

echo "==============================================="
echo "  Claude PDF to Word Converter"
echo "  Starting application..."
echo "==============================================="
echo ""

# Get the directory where this script is located
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org"
    echo "Download the LTS version and run the installer."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "First-time setup: Installing dependencies..."
    echo "This may take a few minutes..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Failed to install dependencies!"
        echo "Please check your internet connection and try again."
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo ""
    echo "Installation complete!"
    echo ""
fi

echo "Starting application..."
echo ""
npm start

read -p "Press Enter to exit..."
