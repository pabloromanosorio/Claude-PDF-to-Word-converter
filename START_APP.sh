#!/bin/bash
# PDF to Word Converter Launcher (Mac/Linux)

echo "========================================="
echo "  PDF to Word Converter"
echo "  Starting application..."
echo "========================================="
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed."
    echo "Please install Python 3.10 or later from python.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "Found Python $PYTHON_VERSION"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo ""
    echo "Setting up virtual environment (first time only)..."
    python3 -m venv venv

    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create virtual environment"
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi

    echo "Installing dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt

    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi

    echo ""
    echo "Setup complete!"
else
    source venv/bin/activate
fi

echo ""
echo "Starting server..."
echo "The application will open in your browser shortly."
echo ""
echo "To stop the server, press Ctrl+C"
echo "========================================="
echo ""

# Start the application
python app.py

# Keep terminal open on error
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Application failed to start"
    echo ""
    read -p "Press Enter to exit..."
fi
