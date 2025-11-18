# Systematic Implementation Plan
**Date:** 2025-11-18
**Goal:** Unify all improvements and implement adaptive system without conflicts

---

## Current State Analysis

### ✅ What Exists (Main Branch)
1. **Documentation** (docs/)
   - ADAPTIVE_SYSTEM.md - Complete adaptive system guide
   - LARGE_DOCUMENT_STRATEGY.md - Chunking strategies for 50+ pages
   - Troubleshooting guides in docs/troubleshooting/

2. **Basic Implementation** (lib/)
   - convertPdf.js - Basic single-call conversion
   - converter.js - Prompt building, code validation, `ensureFileWriting()`
   - jobManager.js - In-memory job tracking
   - validator.js - File upload validation
   - Tests for all modules

3. **Frontend**
   - Multi-file upload support
   - Progress tracking
   - REST polling
   - Settings UI

### ⚠️ What Was on Old Branch (Needs Merging)
From branch `claude/fix-convert-syntax-error-01S29dkqmWpGxx92nF1z2v6M`:

1. **lib/settingsValidator.js** ✨ NEW
   - Validates settings (models, fonts, margins)
   - Prevents prototype pollution
   - JSON size limits

2. **Improved lib/converter.js**
   - Supports both camelCase and snake_case settings
   - Better syntax validation
   - Enhanced prompt with code generation requirements

3. **Improved lib/convertPdf.js**
   - Extended cleanup timeout (5→30 min)
   - Better error handling
   - Adaptive token estimation (basic)

4. **Improved lib/jobManager.js**
   - Graceful shutdown handlers
   - Memory leak fix

5. **CODE_REVIEW.md**
   - Identified 18 issues
   - Priority ranking

### ❌ What's Missing (Needs Implementation)
From documentation but not implemented:

1. **PDF Analysis System**
   - Page count detection
   - Complexity analysis (KB/page)
   - Token estimation
   - Strategy selection logic

2. **Chunking System**
   - pdf-lib integration for splitting
   - Smart chunk size selection
   - Chunk merging logic

3. **Prompt Caching**
   - System messages with cache_control
   - Skills pre-loading

4. **Adaptive Strategy**
   - Single vs chunked decision
   - Dynamic token limits
   - Complexity-based chunking

---

## Implementation Strategy

### Phase 1: Merge Critical Fixes (PRIORITY 1)
**Goal:** Bring improvements from old branch to main WITHOUT conflicts

**Files to merge:**
1. ✅ lib/settingsValidator.js (NEW - safe to add)
2. ✅ lib/settingsValidator.test.js (NEW - safe to add)
3. ⚠️  lib/converter.js (MERGE carefully - already exists)
4. ⚠️  lib/convertPdf.js (MERGE carefully - already exists)
5. ⚠️  lib/jobManager.js (MERGE carefully - already exists)
6. ⚠️  server.js (MERGE carefully - already exists)
7. ✅ CODE_REVIEW.md (NEW - safe to add, renamed to avoid conflicts)

**Merge Strategy:**
- For NEW files: Copy directly
- For EXISTING files: Manually merge only the improvements, not wholesale replacement

**Specific Merges:**

#### lib/converter.js
**Keep from main:** Base structure
**Add from branch:**
- Lines 12-25: Support for both camelCase/snake_case settings
- Lines 73-82: Enhanced code generation requirements in prompt
- Lines 96-111: Improved syntax validation with Function constructor

#### lib/convertPdf.js
**Keep from main:** Base structure, adaptive token estimation (lines 76-80)
**Add from branch:**
- Better error logging
- Extended cleanup timeout (200-211)
- Try-catch for cleanup

#### lib/jobManager.js
**Keep from main:** Base structure
**Add from branch:**
- Lines 15-31: Graceful shutdown handlers

#### server.js
**Keep from main:** Base structure
**Add from branch:**
- Import settingsValidator
- Add settings validation in /api/convert (lines 47-53)

---

### Phase 2: Implement Adaptive System (PRIORITY 2)
**Goal:** Add document analysis and strategy selection

**New File:** `lib/pdfAnalyzer.js`
```javascript
/**
 * Analyze PDF complexity and recommend strategy
 * Based on ADAPTIVE_SYSTEM.md
 */
const { PDFDocument } = require('pdf-lib');

async function analyzeDocument(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();
  const sizeKB = pdfBuffer.length / 1024;

  const kbPerPage = sizeKB / pageCount;

  // Complexity classification
  const complexity = kbPerPage > 100 ? 'high' : kbPerPage > 50 ? 'medium' : 'low';

  // Token estimation per page
  let tokensPerPage;
  switch(complexity) {
    case 'high': tokensPerPage = 2000; break;
    case 'medium': tokensPerPage = 1200; break;
    default: tokensPerPage = 700; break;
  }

  const estimatedOutputTokens = pageCount * tokensPerPage;

  return {
    pageCount,
    sizeKB: Math.round(sizeKB),
    complexity,
    kbPerPage: Math.round(kbPerPage),
    estimatedOutputTokens,
    needsChunking: estimatedOutputTokens > 20000 || pageCount > 30
  };
}

function selectStrategy(analysis) {
  const { pageCount, complexity, estimatedOutputTokens, needsChunking } = analysis;

  if (!needsChunking) {
    return {
      type: 'single',
      maxTokens: Math.min(estimatedOutputTokens * 1.3, 64000),
      chunks: 1,
      reason: `${pageCount} pages, ${complexity} complexity - single request optimal`
    };
  }

  // Determine chunk size based on complexity
  let pagesPerChunk;
  if (complexity === 'high') {
    pagesPerChunk = 5;
  } else if (complexity === 'medium') {
    pagesPerChunk = 10;
  } else {
    pagesPerChunk = 15;
  }

  const numChunks = Math.ceil(pageCount / pagesPerChunk);

  return {
    type: 'chunked',
    maxTokens: 24000,
    chunks: numChunks,
    pagesPerChunk,
    reason: `${pageCount} pages, ${complexity} complexity - ${numChunks} chunks optimal`
  };
}

module.exports = { analyzeDocument, selectStrategy };
```

**Modify:** `lib/convertPdf.js`
- Add PDF analysis before API call
- Use analysis to determine token limits
- Log analysis results

---

### Phase 3: Implement Chunking (PRIORITY 3)
**Goal:** Add smart PDF splitting and chunk merging

**New File:** `lib/pdfChunker.js`
```javascript
/**
 * PDF chunking utilities
 * Based on LARGE_DOCUMENT_STRATEGY.md
 */
const { PDFDocument } = require('pdf-lib');

async function splitPdfIntoChunks(pdfBuffer, pagesPerChunk) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  const chunks = [];

  for (let i = 0; i < totalPages; i += pagesPerChunk) {
    const newPdf = await PDFDocument.create();
    const endPage = Math.min(i + pagesPerChunk, totalPages);

    const copiedPages = await newPdf.copyPages(
      pdfDoc,
      Array.from({ length: endPage - i }, (_, j) => i + j)
    );

    copiedPages.forEach(page => newPdf.addPage(page));
    const pdfBytes = await newPdf.save();

    chunks.push({
      index: Math.floor(i / pagesPerChunk),
      startPage: i + 1,
      endPage: endPage,
      totalPages: totalPages,
      buffer: Buffer.from(pdfBytes),
      base64: Buffer.from(pdfBytes).toString('base64')
    });
  }

  return chunks;
}

function mergeChunkCodes(chunkCodes) {
  // First chunk has imports and document structure
  let merged = chunkCodes[0];

  // Extract content from middle chunks
  for (let i = 1; i < chunkCodes.length - 1; i++) {
    const contentMatch = chunkCodes[i].match(/children:\s*\[([\s\S]*?)\]\s*}\s*\]\s*}\s*\)/);
    if (contentMatch) {
      const newContent = contentMatch[1].trim();
      const insertPoint = merged.lastIndexOf(']') - 1;
      merged = merged.substring(0, insertPoint) +
               ',\n' + newContent +
               merged.substring(insertPoint);
    }
  }

  // Add last chunk's content if it exists
  if (chunkCodes.length > 1) {
    const lastChunk = chunkCodes[chunkCodes.length - 1];
    const contentMatch = lastChunk.match(/children:\s*\[([\s\S]*?)\]\s*}\s*\]\s*}\s*\)/);
    if (contentMatch) {
      const newContent = contentMatch[1].trim();
      const insertPoint = merged.lastIndexOf(']') - 1;
      merged = merged.substring(0, insertPoint) +
               ',\n' + newContent +
               merged.substring(insertPoint);
    }
  }

  // Ensure file writing is present
  if (!merged.includes('Packer.toBuffer')) {
    const lastChunk = chunkCodes[chunkCodes.length - 1];
    const packMatch = lastChunk.match(/(Packer\.toBuffer[\s\S]*?}\);)/);
    if (packMatch) {
      merged += '\n\n' + packMatch[1];
    }
  }

  return merged;
}

module.exports = { splitPdfIntoChunks, mergeChunkCodes };
```

**New Function:** `lib/convertPdf.js - convertChunked()`
- Split PDF into chunks
- Convert each chunk with appropriate prompts
- Merge results
- Track progress per chunk

---

### Phase 4: Add Prompt Caching (PRIORITY 4)
**Goal:** Reduce costs with skills caching

**Modify:** `lib/convertPdf.js`
- Load SKILL_1 and SKILL_2 at module level
- Use system messages with cache_control
- Apply to both single and chunked conversions

```javascript
// At top of convertPdf.js
const SKILL_1 = fs.readFileSync('/mnt/skills/public/docx/SKILL.md', 'utf8');
const SKILL_2 = fs.readFileSync('/mnt/skills/public/docx/docx-js.md', 'utf8');

// In API call
const response = await anthropic.messages.create({
  model,
  max_tokens: strategy.maxTokens,
  temperature: 0.3,
  system: [
    { type: "text", text: SKILL_1, cache_control: { type: "ephemeral" } },
    { type: "text", text: SKILL_2, cache_control: { type: "ephemeral" } }
  ],
  messages: [...]
});
```

---

## Testing Strategy

### Test Suite Structure
```
tests/
├── unit/
│   ├── pdfAnalyzer.test.js
│   ├── pdfChunker.test.js
│   ├── converter.test.js (existing)
│   ├── settingsValidator.test.js (new from branch)
│   └── jobManager.test.js (existing)
├── integration/
│   ├── singleConversion.test.js
│   ├── chunkedConversion.test.js
│   └── adaptiveStrategy.test.js
└── fixtures/
    ├── simple-3page.pdf
    ├── complex-5page.pdf
    ├── large-50page.pdf
    └── expected-outputs/
```

### Test Scenarios
1. **Small PDFs (1-10 pages)** → Single request
2. **Medium PDFs (10-30 pages)** → Single request with high tokens
3. **Large PDFs (30-50 pages)** → Chunking strategy
4. **Complex PDFs (high KB/page)** → Small chunks
5. **Error handling** → Validation, syntax errors, API failures

---

## Implementation Order

### Step 1: Merge Critical Fixes ⚡
**Time:** 30 minutes
**Files:** 7 files (5 merge, 2 new)
**Test:** Run existing tests, verify no regressions

### Step 2: Add PDF Analysis 📊
**Time:** 45 minutes
**Files:** lib/pdfAnalyzer.js (new), tests/unit/pdfAnalyzer.test.js (new)
**Test:** Unit tests for analysis and strategy selection

### Step 3: Integrate Analysis into Conversion ⚙️
**Time:** 30 minutes
**Files:** lib/convertPdf.js (modify)
**Test:** Single conversions still work, logs show analysis

### Step 4: Add Chunking System ✂️
**Time:** 1 hour
**Files:** lib/pdfChunker.js (new), tests/unit/pdfChunker.test.js (new)
**Test:** Unit tests for splitting and merging

### Step 5: Add Chunked Conversion Function 🔀
**Time:** 1 hour
**Files:** lib/convertPdf.js (add convertChunked function)
**Test:** End-to-end test with 50-page PDF

### Step 6: Add Prompt Caching 💰
**Time:** 30 minutes
**Files:** lib/convertPdf.js (modify API calls)
**Test:** Verify caching works (check response usage)

### Step 7: Integration Testing 🧪
**Time:** 1 hour
**Files:** tests/integration/* (new)
**Test:** All scenarios with real PDFs

### Step 8: Documentation Update 📝
**Time:** 30 minutes
**Files:** README.md, docs/IMPLEMENTATION_STATUS.md (new)
**Test:** Documentation review

---

## Total Time Estimate: 5-6 hours

## Success Criteria

✅ All existing tests pass
✅ New tests cover 80%+ of new code
✅ No conflicts or regressions
✅ Adaptive system works for 1-100 page documents
✅ Chunking works reliably for 30+ page docs
✅ Prompt caching reduces costs by 70%+
✅ Code is clean, documented, and maintainable
✅ Main branch is unified and production-ready

---

## Risk Mitigation

### Risk: Breaking Existing Functionality
**Mitigation:** Run full test suite after each step, use feature flags

### Risk: Merge Conflicts
**Mitigation:** Manual merges with clear documentation of changes

### Risk: Chunking Complexity
**Mitigation:** Start with simple merging, iterate if needed

### Risk: Cost Overruns
**Mitigation:** Test caching thoroughly, monitor token usage

---

## Next Actions

1. **Review this plan** - Approve/adjust
2. **Create feature branch** - `feature/unified-adaptive-system`
3. **Execute Step 1** - Merge critical fixes
4. **Test after each step** - Ensure stability
5. **Iterate based on test results**
6. **Merge to main** when complete

---

*End of Implementation Plan*
