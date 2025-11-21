# API Changes

## November 21, 2025: Switched from Files API to Base64 Encoding

### Why
- Files API (beta) became unreliable (404 errors)
- Files API is designed for repeated uploads; we do one-time conversions
- Base64 is the standard documented approach

### What Changed
- **Removed:** Files API upload step (`anthropic.beta.files.upload`)
- **Removed:** `toFile` import from SDK
- **Added:** Direct base64 encoding (`pdfBuffer.toString('base64')`)
- **Removed:** `files-api-2025-04-14` beta from Messages API call
- **Kept:** Files API download for output (skills-generated files)

### Impact
- **Faster:** One fewer API call (no upload step)
- **More reliable:** No beta endpoint dependencies for input
- **Same functionality:** Same Messages API, same features (skills, streaming, caching)
- **Same authentication:** Still uses `ANTHROPIC_API_KEY` environment variable

### Technical Details

**Before (Files API):**
```javascript
const fileUpload = await anthropic.beta.files.upload({
  file: await toFile(fs.createReadStream(tempPdfPath), 'input.pdf', {
    type: 'application/pdf'
  })
}, { betas: ['files-api-2025-04-14'] });

// Then use file_id in Messages API
source: {
  type: 'file',
  file_id: fileUpload.id
}
```

**After (Base64):**
```javascript
const pdfBase64 = processedPdfBuffer.toString('base64');

// Send directly in Messages API
source: {
  type: 'base64',
  media_type: 'application/pdf',
  data: pdfBase64
}
```

### API Endpoints Used

- **Messages API:** `POST /v1/messages` (unchanged)
- **Beta headers:** `code-execution-2025-08-25`, `skills-2025-10-02` (unchanged)
- **Files API download:** Still used for output files from docx skill (unchanged)

### Features Preserved

All features continue to work:
- ✅ Sonnet 4.5 and Haiku 4.5 support
- ✅ Docx skill for Word generation
- ✅ Prompt caching (90% cost reduction)
- ✅ Streaming API for real-time updates
- ✅ Page range selection
- ✅ Custom instructions
- ✅ Enhanced prompts for complex tables
- ✅ Table preservation
