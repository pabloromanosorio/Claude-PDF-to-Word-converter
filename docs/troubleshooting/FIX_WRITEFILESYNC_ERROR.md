# Fix: Missing writeFileSync Error

## Your Error
```
Code validation failed: Missing writeFileSync
```

## What This Means
Claude is generating the document structure but **forgetting to save it to a file**. The code creates the Document object but doesn't include the final step to write it.

---

## Solution 1: Add Auto-Complete Function (QUICKEST FIX)

Add this function to automatically complete the code if it's missing the file writing:

```javascript
function ensureFileWriting(code, outputPath) {
  // Check if code already has file writing
  if (code.includes('writeFileSync') || code.includes('writeFile')) {
    return code; // Already has it
  }
  
  // Find where to add the file writing
  // Look for the closing of the Document creation
  const lastBrace = code.lastIndexOf('});');
  
  if (lastBrace === -1) {
    throw new Error('Cannot find document structure in generated code');
  }
  
  // Check if Packer.toBuffer is already there (without writeFileSync)
  if (code.includes('Packer.toBuffer')) {
    // Has Packer but no writeFileSync - add it
    const packerStart = code.indexOf('Packer.toBuffer');
    const afterPacker = code.indexOf(');', packerStart);
    
    if (afterPacker > 0) {
      // Insert writeFileSync into the existing Packer callback
      const before = code.substring(0, afterPacker + 2);
      const after = code.substring(afterPacker + 2);
      
      return before + `.then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});` + after;
    }
  }
  
  // No Packer at all - add the complete file writing block
  const codeWithoutLastBrace = code.substring(0, lastBrace + 3);
  
  return codeWithoutLastBrace + `

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});`;
}

// Use it in your conversion endpoint:
app.post('/convert', upload.single('pdf'), async (req, res) => {
  const sessionId = crypto.randomUUID();
  const workDir = `/tmp/conversion-${sessionId}`;
  
  try {
    // ... setup code ...
    
    // Get code from API
    let code = message.content[0].text;
    
    // Clean it
    code = cleanCode(code);
    
    // Validate
    const validation = validateCode(code);
    
    // If missing writeFileSync, add it automatically
    if (validation.issues.includes('Missing writeFileSync')) {
      console.log(`[${sessionId}] Adding missing file writing code...`);
      code = ensureFileWriting(code, `${workDir}/outputs/converted.docx`);
      
      // Validate again
      const revalidation = validateCode(code);
      if (!revalidation.valid) {
        throw new Error(`Still invalid after adding writeFileSync: ${revalidation.issues.join(', ')}`);
      }
      
      console.log(`[${sessionId}] File writing code added ✓`);
    }
    
    // Now execute
    // ...
  } catch (error) {
    // ...
  }
});
```

---

## Solution 2: Even More Explicit Prompt

Replace your conversion prompt with this **ultra-explicit** version:

```javascript
function getConversionPrompt(outputPath) {
  return `You are a JavaScript code generator. Your ONLY task is to output executable code.

CRITICAL: The code MUST follow this EXACT structure:

PART 1 - IMPORTS (REQUIRED):
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

PART 2 - DOCUMENT CREATION (REQUIRED):
const doc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } }
    },
    children: [
      // Your content here - paragraphs, tables, etc.
    ]
  }]
});

PART 3 - FILE SAVING (ABSOLUTELY REQUIRED):
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});

ALL THREE PARTS ARE MANDATORY. Do not skip PART 3.

Now, analyze the PDF and generate code following this EXACT structure:
1. Read /mnt/skills/public/docx/SKILL.md completely
2. Read /mnt/skills/public/docx/docx-js.md completely  
3. Create paragraphs and tables based on PDF content
4. MUST include all three parts above
5. NO markdown blocks (no \`\`\`)
6. NO explanatory text

The last 4 lines of your output MUST be:
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});

Output the complete JavaScript code now:`;
}
```

---

## Solution 3: Check Debug Files

Your error message says debug files are saved. Let's check them:

```bash
# Go to the debug directory
cd /tmp/conversion-e30800be-c6ee-401c-ab47-7ca45a3098b0

# List files
ls -la

# You should see:
# - raw.txt            (original API response)
# - cleaned.js         (after cleaning)
# - validation_errors.txt (what failed)

# Check the cleaned code
cat cleaned.js | tail -20

# See what it's missing
cat validation_errors.txt
```

Look at the end of `cleaned.js` - does it have:
- `Packer.toBuffer(doc)` ?
- `fs.writeFileSync(...)` ?
- Both?

---

## Complete Fixed Server Code

Here's the complete server with auto-completion:

```javascript
const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// IMPROVED PROMPT - Emphasizes file writing
function getConversionPrompt(outputPath) {
  return `You are a code generator. Output ONLY executable JavaScript code.

REQUIRED STRUCTURE (all parts mandatory):

1. IMPORTS:
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

2. READ SKILLS:
- /mnt/skills/public/docx/SKILL.md (complete)
- /mnt/skills/public/docx/docx-js.md (complete)

3. DOCUMENT CREATION:
const doc = new Document({
  sections: [{ children: [/* content */] }]
});

4. FILE WRITING (CRITICAL - DO NOT SKIP):
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Done');
});

Your output MUST:
- Start with: const { Document, Packer...
- End with: });
- Include all 4 parts above
- Have NO markdown blocks
- Have NO text before/after code

The LAST 4 LINES must be:
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Done');
});

Generate the complete code now:`;
}

// VALIDATION
function validateCode(code) {
  const issues = [];
  
  if (!code.includes("require('docx')")) issues.push("Missing docx import");
  if (!code.includes("require('fs')")) issues.push("Missing fs import");
  if (!code.includes('Document')) issues.push("Missing Document");
  if (!code.includes('Packer')) issues.push("Missing Packer");
  if (!code.includes('writeFileSync')) issues.push("Missing writeFileSync");
  if (code.includes('```')) issues.push("Has markdown blocks");
  
  return {
    valid: issues.length === 0,
    issues: issues
  };
}

// CLEANING
function cleanCode(code) {
  let clean = code
    .replace(/```javascript\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  
  const start = clean.indexOf('const {');
  if (start > 0) clean = clean.substring(start);
  
  return clean;
}

// AUTO-COMPLETE FILE WRITING
function ensureFileWriting(code, outputPath) {
  if (code.includes('writeFileSync')) {
    return code; // Already has it
  }
  
  console.log('Adding missing file writing code...');
  
  // Find end of document structure
  let insertPoint = code.lastIndexOf('});');
  
  if (insertPoint === -1) {
    throw new Error('Cannot find document structure');
  }
  
  // Move past the });
  insertPoint += 3;
  
  // Add file writing
  const before = code.substring(0, insertPoint);
  const after = code.substring(insertPoint);
  
  const fileWriting = `

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});`;
  
  return before + fileWriting + after;
}

// MAIN ENDPOINT
app.post('/convert', upload.single('pdf'), async (req, res) => {
  const id = crypto.randomUUID();
  const workDir = `/tmp/conversion-${id}`;
  
  try {
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(`${workDir}/outputs`, { recursive: true });
    
    console.log(`[${id}] Starting conversion`);
    
    // Call API
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      temperature: 0.3,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: req.file.buffer.toString('base64')
            }
          },
          {
            type: "text",
            text: getConversionPrompt(`${workDir}/outputs/converted.docx`)
          }
        ]
      }]
    });
    
    console.log(`[${id}] API response received`);
    
    // Process response
    let code = message.content[0].text;
    fs.writeFileSync(`${workDir}/raw.txt`, code);
    
    code = cleanCode(code);
    fs.writeFileSync(`${workDir}/cleaned.js`, code);
    
    // Validate
    let validation = validateCode(code);
    
    // Auto-fix missing writeFileSync
    if (validation.issues.includes('Missing writeFileSync')) {
      console.log(`[${id}] Missing writeFileSync, adding it...`);
      code = ensureFileWriting(code, `${workDir}/outputs/converted.docx`);
      
      // Validate again
      validation = validateCode(code);
    }
    
    if (!validation.valid) {
      fs.writeFileSync(`${workDir}/validation_errors.txt`, validation.issues.join('\n'));
      throw new Error(`Code validation failed: ${validation.issues.join(', ')}. Debug files saved in ${workDir}`);
    }
    
    console.log(`[${id}] Code validated ✓`);
    
    // Execute
    fs.writeFileSync(`${workDir}/convert.js`, code);
    execSync(`node convert.js`, {
      cwd: workDir,
      timeout: 30000,
      stdio: 'inherit'
    });
    
    console.log(`[${id}] Execution complete ✓`);
    
    // Send result
    const files = fs.readdirSync(`${workDir}/outputs`);
    if (files.length === 0) {
      throw new Error('No output file generated');
    }
    
    const docx = fs.readFileSync(`${workDir}/outputs/${files[0]}`);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=converted.docx');
    res.send(docx);
    
    console.log(`[${id}] Success! ✓`);
    
    // Cleanup
    setTimeout(() => fs.rmSync(workDir, { recursive: true }), 10000);
    
  } catch (error) {
    console.error(`[${id}] Conversion failed:`, error.message);
    res.status(500).json({
      error: 'Conversion failed',
      message: error.message,
      sessionId: id
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
```

---

## Test It

1. **Replace your server.js** with the code above
2. **Restart the server**:
   ```bash
   node server.js
   ```
3. **Test conversion**:
   ```bash
   curl -X POST http://localhost:3000/convert \
     -F "pdf=@test.pdf" \
     -o output.docx
   ```

Watch for this in the console:
```
[abc123] Starting conversion
[abc123] API response received
[abc123] Missing writeFileSync, adding it...
[abc123] Code validated ✓
[abc123] Execution complete ✓
[abc123] Success! ✓
```

---

## Why This Happens

Claude sometimes generates:
```javascript
const doc = new Document({...});
// Stops here - forgets to save!
```

Instead of:
```javascript
const doc = new Document({...});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('output.docx', buffer);
});
```

The `ensureFileWriting()` function automatically adds the missing part.

---

## If Still Failing

Check the debug files:
```bash
cd /tmp/conversion-e30800be-c6ee-401c-ab47-7ca45a3098b0
cat cleaned.js
```

Look at the last few lines - do you see:
- Just `});` and nothing else? → Auto-complete will fix
- `Packer.toBuffer` but no `writeFileSync`? → Auto-complete will fix
- Something else? → Share the last 10 lines here

The code above should handle all cases!
