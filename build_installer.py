"""
Build standalone installers for PDF Converter.

Creates:
- Windows: PDF_Converter.exe
- Mac: PDF_Converter.app (bundled in .dmg)

Requirements:
- PyInstaller 6.x
- On Mac: create-dmg (brew install create-dmg)
"""

import os
import sys
import shutil
import platform
from pathlib import Path
import PyInstaller.__main__


def clean_build_dirs():
    """Remove old build artifacts"""
    dirs_to_remove = ['build', 'dist', '__pycache__']

    for dir_name in dirs_to_remove:
        if Path(dir_name).exists():
            shutil.rmtree(dir_name)
            print(f"✓ Removed {dir_name}/")


def build_windows():
    """Build Windows .exe installer"""
    print("\n📦 Building Windows installer...")

    PyInstaller.__main__.run([
        'app.py',
        '--name=PDF_Converter',
        '--onefile',
        '--windowed',
        '--add-data=static:static',
        '--add-data=image-to-docx-converter.zip:.',
        '--hidden-import=anthropic',
        '--hidden-import=flask',
        '--hidden-import=pypdf',
        '--collect-all=anthropic',
        '--collect-all=flask',
        # '--icon=assets/icon.ico',  # Uncomment when icon is ready
    ])

    print("✓ Windows .exe created in dist/")


def build_mac():
    """Build Mac .app and .dmg"""
    print("\n📦 Building Mac installer...")

    PyInstaller.__main__.run([
        'app.py',
        '--name=PDF_Converter',
        '--onefile',
        '--windowed',
        '--add-data=static:static',
        '--add-data=image-to-docx-converter.zip:.',
        '--hidden-import=anthropic',
        '--hidden-import=flask',
        '--hidden-import=pypdf',
        '--collect-all=anthropic',
        '--collect-all=flask',
        '--osx-bundle-identifier=com.pdfconverter.app',
        # '--icon=assets/icon.icns',  # Uncomment when icon is ready
    ])

    print("✓ Mac .app created in dist/")

    # Create DMG (optional, requires create-dmg)
    try:
        import subprocess

        app_path = Path('dist/PDF_Converter.app')
        dmg_path = Path('dist/PDF_Converter.dmg')

        if dmg_path.exists():
            dmg_path.unlink()

        subprocess.run([
            'create-dmg',
            '--volname', 'PDF Converter',
            '--window-pos', '200', '120',
            '--window-size', '600', '400',
            '--icon-size', '100',
            '--app-drop-link', '400', '200',
            str(dmg_path),
            str(app_path)
        ], check=True)

        print("✓ Mac .dmg created in dist/")

    except (FileNotFoundError, subprocess.CalledProcessError):
        print("⚠️  Could not create .dmg (install with: brew install create-dmg)")
        print("   .app is still available in dist/")


def main():
    print("🏗️  PDF Converter Installer Builder\n")

    # Clean old builds
    clean_build_dirs()

    # Detect platform and build
    system = platform.system()

    if system == 'Windows':
        build_windows()
    elif system == 'Darwin':  # macOS
        build_mac()
    else:
        print(f"❌ Unsupported platform: {system}")
        print("   Supported: Windows, macOS")
        sys.exit(1)

    print("\n✅ Build complete!")
    print("   Output: dist/")
    print("\n📤 Next steps:")
    print("   1. Test the installer on a clean machine")
    print("   2. Upload to GitHub Releases")
    print("   3. Update download links in README.md")


if __name__ == '__main__':
    main()
