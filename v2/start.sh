#!/bin/bash
# PDF to Word Converter v2.0 - Startup Script

set -e

echo "🚀 PDF to Word Converter v2.0"
echo "=============================="
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    echo "Please install Python 3.9 or higher"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✅ Python $PYTHON_VERSION detected"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install requirements
if [ ! -f "venv/.installed" ]; then
    echo "📥 Installing dependencies..."
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    touch venv/.installed
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Check for .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "⚠️  No .env file found"
        echo "Creating .env from .env.example..."
        cp .env.example .env
        echo "📝 Please edit .env and add your Anthropic API key"
        echo "   Then run this script again"
        exit 0
    fi
fi

echo ""
echo "🎉 Starting PDF to Word Converter..."
echo "📡 Server will be available at: http://localhost:8000"
echo "🔑 Configure your API key in the web UI if not set"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=============================="
echo ""

# Start the server
cd backend && python app.py
