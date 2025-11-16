#!/usr/bin/env python
"""
PDF to Word Converter - Desktop Launcher

This launcher:
1. Starts the FastAPI server in background
2. Waits for server to be ready
3. Opens browser automatically
4. Shows system tray icon (optional)
5. Cleans up on exit

Double-click this file (or the built .app/.exe) to start the app!
"""

import sys
import os
import time
import webbrowser
import subprocess
import threading
from pathlib import Path
import socket

# Add backend to path
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    BASE_DIR = Path(sys._MEIPASS)
else:
    # Running as script
    BASE_DIR = Path(__file__).parent

sys.path.insert(0, str(BASE_DIR / 'backend'))


def is_port_in_use(port):
    """Check if a port is already in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0


def wait_for_server(port=8000, timeout=30):
    """Wait for server to be ready"""
    print(f"⏳ Waiting for server to start on port {port}...")
    start_time = time.time()

    while time.time() - start_time < timeout:
        if is_port_in_use(port):
            print("✅ Server is ready!")
            return True
        time.sleep(0.5)

    print("❌ Server failed to start within timeout")
    return False


def open_browser(url="http://localhost:8000"):
    """Open browser to the app"""
    print(f"🌐 Opening browser to {url}")
    time.sleep(1)  # Give server a moment
    webbrowser.open(url)


def run_server():
    """Run the FastAPI server"""
    try:
        # Change to backend directory
        backend_dir = BASE_DIR / 'backend'
        os.chdir(backend_dir)

        # Import and run the app
        print("🚀 Starting PDF to Word Converter v2.0...")
        print("=" * 50)

        from backend.app import app
        import uvicorn

        # Run server
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            log_level="info",
            access_log=False  # Reduce log noise
        )

    except Exception as e:
        print(f"❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
        sys.exit(1)


def main():
    """Main launcher entry point"""

    print("╔════════════════════════════════════════════════╗")
    print("║   PDF to Word Converter v2.0                  ║")
    print("║   Using Claude Vision API + docx Skill        ║")
    print("╚════════════════════════════════════════════════╝")
    print()

    # Check if port is already in use
    if is_port_in_use(8000):
        print("⚠️  Port 8000 is already in use!")
        print("   Another instance might be running.")
        print("   Opening browser to existing instance...")
        open_browser()
        return

    # Start server in background thread
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Wait for server to be ready
    if wait_for_server():
        # Open browser
        open_browser()

        print()
        print("=" * 50)
        print("✅ Application is running!")
        print("📡 Server: http://localhost:8000")
        print("🔑 Configure your API key in the web interface")
        print()
        print("Press Ctrl+C to stop the server")
        print("Or just close this window")
        print("=" * 50)
        print()

        # Keep running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n👋 Shutting down...")
            sys.exit(0)
    else:
        print("❌ Failed to start server")
        print("Check the logs above for errors")
        input("Press Enter to exit...")
        sys.exit(1)


if __name__ == "__main__":
    main()
