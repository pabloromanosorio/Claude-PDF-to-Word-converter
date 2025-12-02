#!/bin/bash

# PDF to Word Converter - Update Script
# This file pulls the latest changes from Git

cd "$(dirname "$0")"

echo "🔄 Checking for updates..."
echo "📂 Working directory: $(pwd)"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Error: Git is not installed."
    echo "Please install Git to use this update script."
    read -n 1 -s -r -p "Press any key to exit..."
    exit 1
fi

# Pull latest changes
echo "⬇️  Pulling latest version..."
git pull

if [ $? -eq 0 ]; then
    echo "✅ Update successful!"
    
    # Update dependencies just in case
    if [ -f "package.json" ]; then
        echo "📦 Updating dependencies..."
        npm install
        echo "🔨 Rebuilding application..."
        npm run build
    fi
    
    echo "🎉 App is now up to date."
else
    echo "❌ Update failed. You might have local changes that conflict."
fi

read -n 1 -s -r -p "Press any key to close..."
