# Switch from Files API to Base64 Encoding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace unreliable Files API upload with standard base64 encoding for PDF input to Claude Messages API.

**Architecture:** Remove Files API upload step, convert PDF buffer to base64 string, send directly in document source. Same Messages API endpoint, same features (skills, streaming, caching), one fewer API call.

**Tech Stack:** Node.js, @anthropic-ai/sdk 0.70.0, Anthropic Messages API

**Problem Context:**
- Files API (beta) was working on Nov 19, now returns 404 errors
- Files API is for repeated uploads; we do one-time conversions
- Base64 encoding is the standard documented approach (Option 2)
- No functionality changes - just input method

**API Details:**
- **Endpoint:** `https://api.anthropic.com/v1/messages` (unchanged)
- **Authentication:** `x-api-key: $ANTHROPIC_API_KEY` (unchanged)
- **Beta headers:** `code-execution-2025-08-25`, `skills-2025-10-02` (same)
- **REMOVING:** `files-api-2025-04-14` beta header (no longer needed)

---

## Task 1: Remove Files API Upload Logic

**Files:**
- Modify: `lib/convertPdf.js:1-90`

**Step 1: Remove toFile import**

In `lib/convertPdf.js`, line 2:

```javascript
// REMOVE THIS LINE:
const { toFile } = require('@anthropic-ai/sdk');
```

Expected result: Only `Anthropic` imported from SDK

**Step 2: Replace Files API upload with base64 encoding**

In `lib/convertPdf.js`, replace lines 57-83 with:

```javascript
    // Step 3: Encode PDF as base64
    jobManager.updateJob(jobId, {
      progress: 20,
      currentStep: 'Encoding PDF'
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({ apiKey });

    // Convert processed PDF buffer to base64
    const pdfBase64 = processedPdfBuffer.toString('base64');
    log(`PDF encoded (${pdfBase64.length} chars)`);
```

**Step 3: Update step numbering in comments**

Change:
- "Step 3: Upload PDF" → "Step 3: Encode PDF"
- "Step 4: Build prompt" stays "Step 4"
- All subsequent steps stay same

**Step 4: Verify no compilation errors**

Run: `node -c lib/convertPdf.js`
Expected: No output (success)

---

## Task 2: Update Messages API Call to Use Base64

**Files:**
- Modify: `lib/convertPdf.js:90-140`

**Step 1: Remove files-api beta header**

In `lib/convertPdf.js`, around line 103, change:

```javascript
    const stream = anthropic.beta.messages.stream({
      model,
      max_tokens: 32000,
      betas: [
        'code-execution-2025-08-25',
        'skills-2025-10-02'
        // REMOVED: 'files-api-2025-04-14'
      ],
```

**Step 2: Change document source from file_id to base64**

In `lib/convertPdf.js`, around line 120, replace:

```javascript
          {
            type: 'document',
            source: {
              type: 'file',
              file_id: fileId
            },
            cache_control: { type: 'ephemeral' }
          },
```

With:

```javascript
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64
            },
            cache_control: { type: 'ephemeral' }
          },
```

**Step 3: Verify no syntax errors**

Run: `node -c lib/convertPdf.js`
Expected: No output (success)

---

## Task 3: Update File Download Logic

**Files:**
- Modify: `lib/convertPdf.js:170-195`

**Context:** Files API download still works for OUTPUT files created by skills. Only INPUT upload is changing.

**Step 1: Verify download logic uses correct beta header**

Check that download code (lines 179-188) keeps `files-api-2025-04-14` beta:

```javascript
    const fileMetadata = await anthropic.beta.files.retrieveMetadata(
      generatedFileId,
      { betas: ['files-api-2025-04-14'] }  // KEEP THIS - for downloads
    );

    const fileContent = await anthropic.beta.files.download(
      generatedFileId,
      { betas: ['files-api-2025-04-14'] }  // KEEP THIS - for downloads
    );
```

**Note:** No changes needed here - downloads still use Files API

**Step 2: Verify cleanup logic**

Check lines 208-214 - workspace cleanup should still work (no changes needed):

```javascript
    setTimeout(() => {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
      jobManager.deleteJob(jobId);
    }, 5 * 60 * 1000);
```

---

## Task 4: Test with Manual Curl (Verification)

**Files:**
- None (verification step)

**Step 1: Create test PDF**

```bash
cd /Users/pabloromanromanosorio/Claude-PDF-to-Word-converter
echo "Test PDF Content" > test-input.txt
# Use any existing PDF in your test files, or create a minimal one
```

**Step 2: Encode PDF to base64**

```bash
PDF_BASE64=$(cat test-input.pdf | base64)
echo "Base64 length: ${#PDF_BASE64}"
```

Expected: Some length output like "Base64 length: 12345"

**Step 3: Test Messages API with base64 (manual curl)**

```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: ${ANTHROPIC_API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "max_tokens: 1024,
    "container": {
      "skills": [{
        "type": "anthropic",
        "skill_id": "docx",
        "version": "latest"
      }]
    },
    "messages": [{
      "role": "user",
      "content": [{
        "type": "document",
        "source": {
          "type": "base64",
          "media_type": "application/pdf",
          "data": "'"${PDF_BASE64}"'"
        }
      }, {
        "type": "text",
        "text": "Convert this to DOCX"
      }]
    }],
    "tools": [{
      "type": "code_execution_20250825",
      "name": "code_execution"
    }]
  }'
```

Expected: JSON response with content blocks (not 404 error)

**Step 4: Verify no Files API calls**

```bash
# Check there are no file upload attempts in logs
grep -r "files.upload" lib/convertPdf.js
```

Expected: No matches (command returns empty)

---

## Task 5: Integration Test with Real Conversion

**Files:**
- None (end-to-end test)

**Step 1: Start server**

```bash
npm start
```

Expected: Server starts at http://localhost:3000

**Step 2: Upload test PDF via UI**

1. Open http://localhost:3000 in browser
2. Upload a simple PDF file
3. Click "Convert to Word"
4. Watch progress bar

**Step 3: Monitor server logs**

Watch for:
- ✅ "PDF encoded (XXXXXX chars)" - confirms base64 encoding
- ✅ "Calling Claude API with claude-haiku-4-5-20251001 and docx skill (streaming)"
- ✅ "API responded in X.Xs"
- ✅ "File generated: file-XXXX"
- ✅ "Downloaded: converted.docx"
- ❌ NO "404" errors
- ❌ NO "files.upload" calls

**Step 4: Verify download works**

Click "Download" button in UI
Expected: DOCX file downloads successfully

**Step 5: Verify table preservation**

Open downloaded DOCX:
Expected: Tables are preserved (test with a PDF containing tables)

---

## Task 6: Clean Up and Document

**Files:**
- Create: `docs/api-changes.md`
- Modify: `README.md`

**Step 1: Document API change**

Create `docs/api-changes.md`:

```markdown
# API Changes

## November 21, 2025: Switched from Files API to Base64 Encoding

### Why
- Files API (beta) became unreliable (404 errors)
- Files API is designed for repeated uploads; we do one-time conversions
- Base64 is the standard documented approach

### What Changed
- **Removed:** Files API upload step (`anthropic.beta.files.upload`)
- **Added:** Direct base64 encoding (`pdfBuffer.toString('base64')`)
- **Removed:** `files-api-2025-04-14` beta from Messages API call
- **Kept:** Files API download for output (skills-generated files)

### Impact
- Faster (one fewer API call)
- More reliable (no beta endpoint dependencies for input)
- Same functionality (same Messages API, same features)

### Authentication
No changes - still uses `ANTHROPIC_API_KEY` environment variable
```

**Step 2: Update README if needed**

Check if README mentions Files API - update if so

**Step 3: Commit changes**

```bash
git add lib/convertPdf.js docs/api-changes.md
git commit -m "fix: switch from Files API to base64 encoding for PDF input

- Remove Files API upload (beta, unreliable)
- Use standard base64 encoding approach
- Faster: one fewer API call
- Same Messages API, same features
- Fixes 404 errors from Files API"
```

---

## Verification Checklist

After implementation, verify:

- [ ] No `toFile` import in convertPdf.js
- [ ] No `files.upload` calls in convertPdf.js
- [ ] Messages API uses `type: 'base64'` not `type: 'file'`
- [ ] Files API beta header removed from Messages call
- [ ] Files API beta header KEPT for download calls
- [ ] Server starts without errors
- [ ] PDF conversion completes successfully
- [ ] No 404 errors in logs
- [ ] Downloaded DOCX contains correct content
- [ ] Tables are preserved in output
- [ ] All new features still work (page range, custom instructions, etc.)

---

## Rollback Plan

If base64 encoding doesn't work:

1. Revert commit: `git revert HEAD`
2. Investigate error messages
3. Check Anthropic API status page
4. Try alternative: URL-based upload (if PDF accessible via URL)
