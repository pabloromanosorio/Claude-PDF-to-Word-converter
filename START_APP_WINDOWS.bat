@echo off
REM Claude PDF to Word Converter - Windows Launcher
REM This script ensures the app runs correctly on Windows

echo ===============================================
echo   Claude PDF to Word Converter
echo   Starting application...
echo ===============================================
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

echo App directory: %CD%
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo X ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo Download the LTS version and run the installer.
    echo.
    pause
    exit /b 1
)

REM Get Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo √ Node.js detected: %NODE_VERSION%
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    echo This may take a few minutes...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo X ERROR: Failed to install dependencies!
        echo Please check your internet connection and try again.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo √ Installation complete!
    echo.
)

echo Starting application...
echo.
echo The app window should open shortly.
echo You can minimize this window (but don't close it).
echo.

REM Start the app
npm start

REM If npm start exits, show message
echo.
echo App has closed.
pause
