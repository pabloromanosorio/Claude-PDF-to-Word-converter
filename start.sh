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

# Check for .env file (create if missing, but don't exit)
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "⚠️  No .env file found"
        echo "Creating empty .env file..."
        cp .env.example .env
        echo "🔑 You can configure your API key in the web UI"
    else
        # Create minimal .env
        echo "ANTHROPIC_API_KEY=" > .env
        echo "LOG_LEVEL=INFO" >> .env
    fi
fi

echo ""
echo "🎉 Starting PDF to Word Converter..."
echo "📡 Server will be available at: http://localhost:8000"
echo "🔑 Configure your API key in the web UI if not set"
echo ""

# Kill any existing process on port 8000
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8000 is in use. Stopping existing process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "✅ Port cleared"
fi

echo "Press Ctrl+C to stop the server"
echo "=============================="
echo ""

# Start the server
cd backend && python app.py
