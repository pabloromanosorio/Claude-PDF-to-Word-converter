# Large Document Strategy Guide (50+ Pages)

## Quick Answer

For **50-page documents**, you have 3 options:

| Strategy | Best For | Cost | Speed | Complexity |
|----------|----------|------|-------|------------|
| **Single Request** | Well-structured docs | $2-4 | 15-30s | Low |
| **Smart Chunking** ⭐ | Most 50+ page docs | $3-5 | 20-40s | Medium |
| **Hybrid** | Mixed content types | $2-3 | 25-45s | High |

**Recommendation for 50 pages**: **Smart Chunking** with prompt caching

---

## Option 1: Single Large Request

### Configuration

```javascript
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 64000,  // Maximum available
  temperature: 0.3,
  
  // Prompt caching (essential for large docs)
  system: [
    { type: "text", text: SKILL_1, cache_control: { type: "ephemeral" } },
    { type: "text", text: SKILL_2, cache_control: { type: "ephemeral" } }
  ],
  
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdfBase64  // Full 50-page PDF
        }
      },
      { type: "text", text: conversionPrompt }
    ]
  }]
});
```

### Characteristics

**Pros**:
- ✅ Simplest implementation
- ✅ Consistent formatting across entire document
- ✅ Single API call

**Cons**:
- ❌ Slower (15-30 seconds)
- ❌ Higher risk of timeout
- ❌ May hit token limits if pages are very complex
- ❌ More expensive per attempt

**Cost Estimate (50 pages)**:
```
Input tokens: ~150,000 (50-page PDF base64 + skills)
Output tokens: ~50,000 (generated code)
Cost: ~$0.45 + $0.75 = $1.20 per doc

With prompt caching (after first):
Input: ~100,000 fresh + 50,000 cached (90% discount)
Cost: ~$0.30 + $0.75 = $1.05 per doc
```

**When to use**:
- Documents with consistent structure throughout
- Academic transcripts with repetitive table patterns
- Reports with uniform formatting

---

## Option 2: Smart Chunking ⭐ RECOMMENDED

### Strategy: Process in Logical Sections

Split the document by **content**, not just page numbers:

```
50-page transcript:
├── Chunk 1: Header + Student Info (pages 1-2)
├── Chunk 2: Year 1 courses (pages 3-12) 
├── Chunk 3: Year 2 courses (pages 13-22)
├── Chunk 4: Year 3 courses (pages 23-32)
├── Chunk 5: Year 4 courses (pages 33-42)
└── Chunk 6: Year 5 + Summary (pages 43-50)
```

### Implementation

```javascript
const { PDFDocument } = require('pdf-lib');

// Step 1: Split PDF into chunks
async function splitPdfIntoChunks(pdfBuffer, chunkSize = 10) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  
  const chunks = [];
  
  for (let i = 0; i < totalPages; i += chunkSize) {
    const newPdf = await PDFDocument.create();
    const endPage = Math.min(i + chunkSize, totalPages);
    
    // Copy pages to new PDF
    const pages = await newPdf.copyPages(pdfDoc, 
      Array.from({ length: endPage - i }, (_, j) => i + j)
    );
    
    pages.forEach(page => newPdf.addPage(page));
    
    const pdfBytes = await newPdf.save();
    
    chunks.push({
      startPage: i + 1,
      endPage: endPage,
      buffer: Buffer.from(pdfBytes),
      base64: Buffer.from(pdfBytes).toString('base64')
    });
  }
  
  return chunks;
}

// Step 2: Convert each chunk
async function convertChunk(chunk, chunkIndex, totalChunks, outputDir) {
  console.log(`Converting chunk ${chunkIndex + 1}/${totalChunks} (pages ${chunk.startPage}-${chunk.endPage})`);
  
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 24000,  // Smaller chunks = smaller token needs
    temperature: 0.3,
    
    // Cached skills (same for all chunks)
    system: [
      { type: "text", text: SKILL_1, cache_control: { type: "ephemeral" } },
      { type: "text", text: SKILL_2, cache_control: { type: "ephemeral" } }
    ],
    
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: chunk.base64
          }
        },
        {
          type: "text",
          text: `Convert this PDF chunk (pages ${chunk.startPage}-${chunk.endPage}) to DOCX.
          
This is part ${chunkIndex + 1} of ${totalChunks} chunks.
${chunkIndex === 0 ? 'Include full document setup (imports, styles).' : 'Continue document structure.'}
${chunkIndex === totalChunks - 1 ? 'Include file writing (Packer.toBuffer).' : 'Just create the section content.'}

Save to: ${outputDir}/chunk_${chunkIndex}.js`
        }
      ]
    }]
  });
  
  return message.content[0].text;
}

// Step 3: Merge generated code
function mergeChunks(chunkCodes) {
  // First chunk has imports and document start
  let mergedCode = chunkCodes[0];
  
  // Extract just the content sections from middle chunks
  for (let i = 1; i < chunkCodes.length - 1; i++) {
    const content = extractContentSection(chunkCodes[i]);
    mergedCode = insertContentBefore(mergedCode, content, ']}]});');
  }
  
  // Last chunk has file writing
  const lastChunk = chunkCodes[chunkCodes.length - 1];
  const lastContent = extractContentSection(lastChunk);
  mergedCode = insertContentBefore(mergedCode, lastContent, ']}]});');
  
  return mergedCode;
}

function extractContentSection(code) {
  // Extract just the children array content
  const match = code.match(/children:\s*\[([\s\S]*?)\]\s*}\]\s*}\)\;/);
  return match ? match[1] : '';
}

function insertContentBefore(code, newContent, beforePattern) {
  const index = code.indexOf(beforePattern);
  if (index === -1) return code;
  
  return code.substring(0, index) + 
         ',\n' + newContent + 
         code.substring(index);
}

// Main conversion endpoint with chunking
app.post('/convert-large', upload.single('pdf'), async (req, res) => {
  const id = crypto.randomUUID().substring(0, 8);
  const workDir = `/tmp/conversion-${id}`;
  
  try {
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(`${workDir}/outputs`, { recursive: true });
    
    console.log(`[${id}] Starting large document conversion`);
    const pdfBuffer = req.file.buffer;
    
    // Determine chunk size based on PDF size
    const pdfSizeMB = pdfBuffer.length / (1024 * 1024);
    const chunkSize = pdfSizeMB > 5 ? 8 : 10; // Smaller chunks for larger PDFs
    
    console.log(`[${id}] PDF size: ${pdfSizeMB.toFixed(2)} MB, chunk size: ${chunkSize} pages`);
    
    // Split PDF
    const chunks = await splitPdfIntoChunks(pdfBuffer, chunkSize);
    console.log(`[${id}] Split into ${chunks.length} chunks`);
    
    // Convert each chunk
    const chunkCodes = [];
    let totalCost = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const startTime = Date.now();
      
      const code = await convertChunk(chunks[i], i, chunks.length, workDir);
      
      const elapsed = Date.now() - startTime;
      console.log(`[${id}] Chunk ${i + 1} completed in ${elapsed}ms`);
      
      chunkCodes.push(cleanCode(code));
      
      // Brief pause between chunks to avoid rate limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[${id}] All chunks converted, merging...`);
    
    // Merge and execute
    let finalCode = mergeChunks(chunkCodes);
    finalCode = ensureFileWriting(finalCode, `${workDir}/outputs/converted.docx`);
    
    const validation = validateCode(finalCode);
    if (!validation.valid) {
      throw new Error(`Merged code invalid: ${validation.issues.join(', ')}`);
    }
    
    fs.writeFileSync(`${workDir}/final.js`, finalCode);
    execSync(`node final.js`, { cwd: workDir, timeout: 60000 });
    
    // Send result
    const files = fs.readdirSync(`${workDir}/outputs`);
    const docx = fs.readFileSync(`${workDir}/outputs/${files[0]}`);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=converted-${id}.docx`);
    res.send(docx);
    
    console.log(`[${id}] Success! Processed ${chunks.length} chunks`);
    
    setTimeout(() => fs.rmSync(workDir, { recursive: true, force: true }), 10000);
    
  } catch (error) {
    console.error(`[${id}] Error:`, error.message);
    res.status(500).json({ error: error.message, sessionId: id });
  }
});
```

### Characteristics

**Pros**:
- ✅ More reliable (smaller API calls)
- ✅ Faster individual requests (4-8s each)
- ✅ Better error recovery (one chunk fails, others ok)
- ✅ Can process in parallel
- ✅ Works with prompt caching

**Cons**:
- ❌ More complex implementation
- ❌ Need to merge results
- ❌ Multiple API calls (but cached)

**Cost Estimate (50 pages, 5 chunks of 10 pages)**:
```
Chunk 1:
  Input: 53,500 (PDF + skills + prompt) → $0.16
  Output: 12,000 → $0.18
  Total: $0.34

Chunks 2-5 (with caching):
  Input: 30,000 fresh + 23,500 cached (90% discount) → $0.09
  Output: 12,000 → $0.18
  Total per chunk: $0.27
  Total for 4 chunks: $1.08

Total for 50 pages: $0.34 + $1.08 = $1.42
```

**When to use**:
- ✅ **Documents over 30 pages** (your case!)
- ✅ Documents with varying content types
- ✅ When you need reliability
- ✅ When you want to process sections in parallel

---

## Option 3: Hybrid Approach

### Strategy: Analyze First, Then Process

```javascript
// Step 1: Quick analysis pass (low tokens)
const analysis = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 2000,  // Just need structure
  messages: [{
    role: "user",
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }},
      { type: "text", text: `Analyze this PDF structure. Return JSON:
      {
        "totalPages": number,
        "sections": [
          {"title": "Header", "pages": [1, 2], "type": "header"},
          {"title": "Year 1", "pages": [3, 12], "type": "grades"},
          ...
        ]
      }` }
    ]
  }]
});

const structure = JSON.parse(analysis.content[0].text);

// Step 2: Process each section with appropriate strategy
for (const section of structure.sections) {
  if (section.type === 'header') {
    // Small section - single request
    await convertSection(section, 'single');
  } else if (section.type === 'grades') {
    // Repetitive - use template
    await convertWithTemplate(section);
  }
}
```

**When to use**:
- Very large documents (100+ pages)
- Mixed content types (images, tables, text)
- When optimization is critical

---

## Practical Recommendations

### For 50-Page Documents

#### Strategy 1: Simple Chunking (EASIEST)

```javascript
// 10 pages per chunk = 5 chunks
const CHUNK_SIZE = 10;

async function convertLargeDoc(pdfBuffer) {
  const chunks = await splitPdfIntoChunks(pdfBuffer, CHUNK_SIZE);
  
  const codes = [];
  for (let i = 0; i < chunks.length; i++) {
    const code = await convertChunk(chunks[i], i, chunks.length);
    codes.push(code);
  }
  
  return mergeChunks(codes);
}
```

**Time**: 5 chunks × 6s = ~30 seconds (with caching)
**Cost**: ~$1.40 per document
**Reliability**: High (small chunks)

---

#### Strategy 2: Parallel Processing (FASTEST)

```javascript
async function convertLargeDocParallel(pdfBuffer) {
  const chunks = await splitPdfIntoChunks(pdfBuffer, 10);
  
  // Process all chunks in parallel
  const codes = await Promise.all(
    chunks.map((chunk, i) => convertChunk(chunk, i, chunks.length))
  );
  
  return mergeChunks(codes);
}
```

**Time**: ~10 seconds (all parallel)
**Cost**: Same ($1.40)
**Reliability**: High
**Note**: Be careful with rate limits

---

### Optimal Chunk Sizes

| Document Size | Chunk Size | Number of Chunks | Total Time |
|--------------|------------|------------------|------------|
| 10 pages | No chunking | 1 | 6s |
| 20 pages | No chunking | 1 | 10s |
| 30 pages | 15 pages | 2 | 12s |
| **50 pages** | **10 pages** ⭐ | **5** | **30s** |
| 100 pages | 10 pages | 10 | 60s |
| 100 pages | 20 pages | 5 | 40s |

**Rule of thumb**: **10 pages per chunk** is optimal for most cases.

---

## Cost Comparison (50 Pages)

### Without Prompt Caching

```
Single request: $1.20
Chunking (5×): $1.70 (5 × $0.34)
```

### With Prompt Caching ⭐

```
Single request: $1.05 (first), $1.05 (subsequent)
Chunking (5×): $1.42 (first), $1.42 (subsequent)
                  ↓
            $0.34 + (4 × $0.27) = $1.42
```

**Winner**: Chunking with caching is slightly more expensive but **much more reliable**.

---

## Implementation: Complete Chunking System

### Install PDF Library

```bash
npm install pdf-lib
```

### Complete Server Code

```javascript
const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { PDFDocument } = require('pdf-lib');
const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Load skills once
const SKILL_1 = fs.readFileSync('/mnt/skills/public/docx/SKILL.md', 'utf8');
const SKILL_2 = fs.readFileSync('/mnt/skills/public/docx/docx-js.md', 'utf8');

// PDF splitting function
async function splitPdfIntoChunks(pdfBuffer, pagesPerChunk = 10) {
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
      startPage: i + 1,
      endPage: endPage,
      buffer: Buffer.from(pdfBytes),
      base64: Buffer.from(pdfBytes).toString('base64')
    });
  }
  
  return chunks;
}

// Convert single chunk
async function convertChunk(chunk, index, total, workDir) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  
  const prompt = `Convert pages ${chunk.startPage}-${chunk.endPage} to DOCX code.

${isFirst ? 'Include: imports, document setup' : 'Continue document, add sections'}
${isLast ? 'Include: Packer.toBuffer and writeFileSync' : 'Just create content'}

Output ONLY JavaScript code.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 24000,
    temperature: 0.3,
    system: [
      { type: "text", text: SKILL_1, cache_control: { type: "ephemeral" } },
      { type: "text", text: SKILL_2, cache_control: { type: "ephemeral" } }
    ],
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: chunk.base64 }},
        { type: "text", text: prompt }
      ]
    }]
  });
  
  return {
    code: message.content[0].text,
    tokens: message.usage
  };
}

// Merge chunks (simplified)
function mergeChunks(chunkCodes) {
  // Take structure from first chunk
  let merged = chunkCodes[0];
  
  // Extract content from other chunks and append
  for (let i = 1; i < chunkCodes.length; i++) {
    // Find children array in current merged code
    const childrenEnd = merged.lastIndexOf(']'); // Find last ] before }]});
    
    // Extract new content from this chunk
    const match = chunkCodes[i].match(/children:\s*\[([\s\S]*?)\]/);
    if (match) {
      const newContent = match[1].trim();
      // Insert before the closing ]
      merged = merged.substring(0, childrenEnd) + 
               ',\n' + newContent + 
               merged.substring(childrenEnd);
    }
  }
  
  return merged;
}

// Main endpoint
app.post('/convert', upload.single('pdf'), async (req, res) => {
  const id = crypto.randomUUID().substring(0, 8);
  const workDir = `/tmp/conversion-${id}`;
  
  try {
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(`${workDir}/outputs`, { recursive: true });
    
    const pdfBuffer = req.file.buffer;
    const pdfSizeMB = pdfBuffer.length / (1024 * 1024);
    
    console.log(`[${id}] PDF: ${pdfSizeMB.toFixed(2)} MB`);
    
    // Decide strategy based on size
    const shouldChunk = pdfSizeMB > 1.5; // ~15+ pages
    
    if (shouldChunk) {
      console.log(`[${id}] Using chunking strategy`);
      
      const chunks = await splitPdfIntoChunks(pdfBuffer, 10);
      console.log(`[${id}] Split into ${chunks.length} chunks`);
      
      const chunkCodes = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[${id}] Converting chunk ${i + 1}/${chunks.length}`);
        const result = await convertChunk(chunks[i], i, chunks.length, workDir);
        chunkCodes.push(cleanCode(result.code));
        
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 500)); // Rate limit pause
        }
      }
      
      code = mergeChunks(chunkCodes);
    } else {
      console.log(`[${id}] Using single request`);
      
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 32000,
        temperature: 0.3,
        system: [
          { type: "text", text: SKILL_1, cache_control: { type: "ephemeral" } },
          { type: "text", text: SKILL_2, cache_control: { type: "ephemeral" } }
        ],
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBuffer.toString('base64') }},
            { type: "text", text: getConversionPrompt(`${workDir}/outputs/converted.docx`) }
          ]
        }]
      });
      
      code = cleanCode(message.content[0].text);
    }
    
    // Validate and execute
    code = ensureFileWriting(code, `${workDir}/outputs/converted.docx`);
    
    const validation = validateCode(code);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.issues.join(', ')}`);
    }
    
    fs.writeFileSync(`${workDir}/convert.js`, code);
    execSync(`node convert.js`, { cwd: workDir, timeout: 60000 });
    
    // Send result
    const files = fs.readdirSync(`${workDir}/outputs`);
    const docx = fs.readFileSync(`${workDir}/outputs/${files[0]}`);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=converted.docx`);
    res.send(docx);
    
    console.log(`[${id}] Success!`);
    setTimeout(() => fs.rmSync(workDir, { recursive: true }), 10000);
    
  } catch (error) {
    console.error(`[${id}] Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Server ready with chunking support'));
```

---

## Decision Matrix

### When to Use Each Strategy

| Pages | Strategy | Token Limit | Chunks | Time | Cost |
|-------|----------|-------------|--------|------|------|
| 1-20 | Single | 24K | 1 | 6s | $0.40 |
| 20-30 | Single | 32K | 1 | 10s | $0.60 |
| **30-60** | **Chunking** ⭐ | **24K** | **4-6** | **30s** | **$1.40** |
| 60-100 | Chunking | 24K | 8-10 | 60s | $2.50 |
| 100+ | Hybrid | varies | varies | varies | $3-5 |

---

## Bottom Line for Your 50-Page Docs

### Recommended Setup:

```javascript
// Configuration
const CONFIG = {
  maxTokens: 24000,        // Per chunk
  chunkSize: 10,           // Pages per chunk
  promptCaching: true,     // Essential!
  parallelProcessing: false // Start false, enable later
};

// Expected results for 50 pages:
// - 5 chunks
// - ~30 seconds total
// - ~$1.40 per document
// - High reliability
```

### Quick Win:

1. **Increase token limit to 24,000**
2. **Add prompt caching**
3. **Test with current implementation** 
4. If successful → done!
5. If documents > 30 pages → add chunking

Start simple, add chunking only if needed!
