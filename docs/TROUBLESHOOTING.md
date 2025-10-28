# Troubleshooting Guide

## Common Issues

### "Invalid API Key" Error

**Symptoms:** App shows "Invalid API key" after pasting

**Solutions:**
1. Check the key starts with `sk-ant-api03-`
2. Make sure you copied the entire key
3. No extra spaces before/after the key
4. Generate a new key in Anthropic Console if needed

---

### "Billing Not Set Up" Error

**Symptoms:** Conversion fails with billing error

**Solution:**
1. Go to https://console.anthropic.com/billing
2. Click "Add Payment Method"
3. Enter credit card details
4. Try conversion again

---

### App Won't Open (Windows)

**Symptoms:** Double-clicking .exe does nothing

**Solutions:**
1. Right-click → "Run as Administrator"
2. Check Windows Defender didn't block it:
   - Settings → Windows Security → Virus & Threat Protection
   - "Protection history"
   - Allow the app if blocked

---

### "Unidentified Developer" (Mac)

**Symptoms:** Mac won't open the app

**Solutions:**
1. Right-click app → "Open" (instead of double-click)
2. Click "Open" in the dialog

**Alternative:**
```bash
xattr -d com.apple.quarantine /Applications/PDF\ Converter.app
```

---

### Browser Doesn't Open

**Symptoms:** App starts but no browser window

**Solution:**
Manually open: http://127.0.0.1:5000

---

### Conversion Takes Too Long

**Symptoms:** Progress stuck for 5+ minutes

**Solutions:**
1. Check internet connection
2. Try smaller file/fewer pages
3. Switch to Haiku model (faster)
4. Check Anthropic status: https://status.anthropic.com

---

### "No Code Generated" Error

**Symptoms:** Conversion fails with code generation error

**Solutions:**
1. Try again (temporary API issue)
2. Switch models (Haiku ↔ Sonnet)
3. Check document isn't corrupted
4. Try with different document

---

### Output Quality Issues

**Symptoms:** Word document doesn't match original

**Solutions:**
1. Use Sonnet model (better quality)
2. Check original PDF isn't low resolution
3. For complex layouts, use "Advanced" settings
4. Report issue with example: [GitHub Issues](../../issues)

---

### App Crashes on Startup

**Symptoms:** App closes immediately after starting

**Solutions:**

**Windows:**
1. Delete config: `C:\Users\YourName\.pdf-converter\`
2. Restart app
3. Re-enter API key

**Mac:**
1. Delete config: `~/.pdf-converter/`
2. Restart app
3. Re-enter API key

---

## Still Need Help?

1. **Check logs:**
   - Windows: `C:\Users\YourName\.pdf-converter\app.log`
   - Mac: `~/.pdf-converter/app.log`

2. **Report issue:**
   - Go to: [GitHub Issues](../../issues)
   - Include: Error message, steps to reproduce
   - Attach log file (remove API key first!)

3. **Anthropic API issues:**
   - Check: https://status.anthropic.com
   - Contact: Anthropic support
