Icon Requirements for Image to Word Converter
==============================================

This directory should contain the application icons for building installers.

Required Files:
---------------

1. icon.icns (macOS)
   - Format: Apple Icon Image format (.icns)
   - Size: 512x512 pixels minimum
   - Recommended: Include multiple resolutions (16x16, 32x32, 128x128, 256x256, 512x512, 1024x1024)
   - Tools to create: iconutil (built-in macOS), Image2icon, or online converters

2. icon.ico (Windows)
   - Format: Windows Icon format (.ico)
   - Size: 256x256 pixels minimum
   - Recommended: Include multiple resolutions (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
   - Tools to create: GIMP, IcoFX, or online converters

Creating Icons:
---------------

From a 1024x1024 PNG source image:

macOS (.icns):
  mkdir icon.iconset
  sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
  sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
  sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
  sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
  sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
  sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
  sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
  sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
  sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
  sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
  iconutil -c icns icon.iconset

Windows (.ico):
  Use online converter (e.g., https://convertio.co/png-ico/)
  Or use GIMP: File > Export As > .ico > Select multiple sizes

Note:
-----
The build process will fail if these icon files are missing. Create placeholder
or actual icons before running `npm run build`.
