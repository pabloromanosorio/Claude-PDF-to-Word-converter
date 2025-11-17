# Debugging Guide

## How to See Logs

### Method 1: Server Terminal (Best for Development)

The **primary logs** are in the terminal where you started the server:

```bash
npm start
# or
./start.sh
```

All errors, warnings, and debug info appear here in real-time.

### Method 2: Enable Detailed Logging in UI

In the browser settings panel:
1. Click **Settings** (⚙️ icon)
2. Check **"Enable Logging"** checkbox
3. Try conversion again

This enables detailed logging including:
- Job IDs
- API call timing
- Code validation steps
- Execution output
- Token usage

### Method 3: Browser Console

Open browser developer console (F12) to see frontend logs:
- Network requests
- API responses
- Job status updates

---

## Common Errors & Solutions

### Error: "Invalid code generated - missing required docx imports"

**Cause:** Claude didn't generate valid JavaScript code or omitted imports.

**How to Debug:**
1. Enable logging (see above)
2. Try conversion again
3. Check terminal for:
   ```
   [job-id] Raw Claude response (first 500 chars): ...
   [job-id] Full response: ...
   ```

**Solutions:**
- ✅ **Fixed in latest version** - validation is now more lenient
- If still failing, check that Claude has access to `/mnt/skills/public/docx/` files
- Try using **Sonnet** model instead of **Haiku** for better code generation

### Error: "Code execution failed"

**Cause:** Generated code has syntax errors or runtime errors.

**How to Debug:**
1. Check terminal logs for:
   ```
   [job-id] stderr: <error details>
   [job-id] Generated code saved to: /tmp/conversion-<job-id>/convert.js
   ```
2. Open the saved code file to inspect what Claude generated
3. Check for missing `require()` statements or syntax errors

**Solutions:**
- Enable logging to see exact error
- Check if `docx` package is installed: `npm list docx`
- Try simpler PDF first to verify setup

### Error: "No output file created"

**Cause:** Code ran but didn't save the DOCX file.

**How to Debug:**
1. Check execution logs for errors
2. Verify the code includes:
   ```javascript
   Packer.toBuffer(doc).then(buffer => {
     fs.writeFileSync('/path/outputs/converted.docx', buffer);
   });
   ```

**Solutions:**
- Check file permissions on `/tmp/`
- Enable logging to see if code executed successfully

### Error: "ANTHROPIC_API_KEY not configured"

**Cause:** API key not set.

**Solutions:**
1. Check `.env` file exists with: `ANTHROPIC_API_KEY=sk-ant-...`
2. Or set via UI: Settings → API Key
3. Restart server after adding key

---

## Advanced Debugging

### Inspect Generated Code

When logging is enabled, generated code is saved to:
```
/tmp/conversion-<job-id>/convert.js
```

You can:
1. Read the file to see what Claude generated
2. Run it manually: `cd /tmp/conversion-<job-id> && node convert.js`
3. Fix bugs and test

### Monitor API Usage

With logging enabled, each conversion shows:
```
[job-id] Tokens: 12345 input, 6789 output
[job-id] Cost: $0.1234
```

Track costs across multiple conversions in the Stats panel.

### Test Different Models

Try switching models if one fails:
- **Haiku**: Faster, cheaper, sometimes less reliable for complex PDFs
- **Sonnet**: Slower, more expensive, better code generation

---

## Reporting Issues

When reporting bugs, include:
1. ✅ Terminal logs (with logging enabled)
2. ✅ Browser console errors (F12)
3. ✅ PDF characteristics (pages, tables, images)
4. ✅ Model used (Haiku vs Sonnet)
5. ✅ Generated code (from `/tmp/conversion-*/convert.js`)

This helps diagnose the issue faster!
