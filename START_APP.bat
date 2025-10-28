@echo off
REM PDF to Word Converter Launcher (Windows)

echo =========================================
echo   PDF to Word Converter
echo   Starting application...
echo =========================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.10 or later from python.org
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

REM Check Python version
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo Found Python %PYTHON_VERSION%

REM Check if venv exists
if not exist "venv\" (
    echo.
    echo Setting up virtual environment (first time only)...
    python -m venv venv

    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        echo.
        pause
        exit /b 1
    )

    echo Installing dependencies...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt

    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        echo.
        pause
        exit /b 1
    )

    echo.
    echo Setup complete!
) else (
    call venv\Scripts\activate.bat
)

echo.
echo Starting server...
echo The application will open in your browser shortly.
echo.
echo To stop the server, press Ctrl+C
echo =========================================
echo.

REM Start the application
python app.py

REM Keep terminal open on error
if errorlevel 1 (
    echo.
    echo ERROR: Application failed to start
    echo.
    pause
)
