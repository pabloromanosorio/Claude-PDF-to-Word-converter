@echo off
echo 🚀 Starting PDF to Word Converter...

REM Check if the standalone executable exists
if exist "dist\pdf-to-docx-converter-win-x64.exe" (
    echo Running standalone executable...
    REM Try to open browser after a short delay (fallback)
    start /b cmd /c "timeout /t 3 >nul && start http://localhost:3000"
    "dist\pdf-to-docx-converter-win-x64.exe"
    goto :EOF
)

REM Fallback to Node.js if installed
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Node.js detected. Installing dependencies if needed...
    if not exist "node_modules" (
        call npm install
    )
    echo Starting server...
    call npm start
) else (
    echo ❌ Error: Could not find the executable and Node.js is not installed.
    echo Please download the 'dist' folder containing the executable.
    pause
    exit /b 1
)
