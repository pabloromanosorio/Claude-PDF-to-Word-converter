# QUICK FIX - Copy-Paste This Code

## Replace Your Current Implementation With This

```javascript
// server.js - COMPLETE WORKING VERSION
const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY 
});

// ==========================================
// IMPROVED PROMPT (KEY FIX)
// ==========================================
function getConversionPrompt(outputPath) {
  return `You must output ONLY executable JavaScript code. No explanations, no markdown.

STEP 1: Read these files completely:
- /mnt/skills/public/docx/SKILL.md
- /mnt/skills/public/docx/docx-js.md

STEP 2: Analyze the PDF and generate code that follows this EXACT structure:

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

const doc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } }
    },
    children: [
      // Create paragraphs and tables here based on PDF content
      new Paragraph({
        children: [new TextRun("Content from PDF")]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});

CRITICAL RULES:
- First line MUST be: const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
- Second line MUST be: const fs = require('fs');
- Last lines MUST be the Packer.toBuffer() call with writeFileSync
- NO markdown code blocks (no \`\`\`javascript or \`\`\`)
- NO text before or after the code
- Use BorderStyle.SINGLE for table borders
- Use ShadingType.CLEAR for table shading
- Never use \\n for line breaks - use separate Paragraph elements

Your output must be ready to save as a .js file and run with: node script.js

Output the JavaScript code now:`;
}

// ==========================================
// CODE VALIDATION (CATCHES ERRORS)
// ==========================================
function validateCode(code) {
  const issues = [];
  
  // Must have docx import
  if (!code.includes("require('docx')")) {
    issues.push("Missing require('docx')");
  }
  
  // Must have required components
  const required = ['Document', 'Packer', 'Paragraph', 'TextRun'];
  required.forEach(comp => {
    if (!code.includes(comp)) {
      issues.push(`Missing ${comp}`);
    }
  });
  
  // Must have fs
  if (!code.includes("require('fs')")) {
    issues.push("Missing require('fs')");
  }
  
  // Must write file
  if (!code.includes('writeFileSync')) {
    issues.push("Missing writeFileSync");
  }
  
  // Should not have markdown
  if (code.includes('```')) {
    issues.push("Contains markdown blocks");
  }
  
  // Should start with const
  if (!code.trim().startsWith('const')) {
    issues.push("Doesn't start with const");
  }
  
  return {
    valid: issues.length === 0,
    issues: issues
  };
}

// ==========================================
// AUTO-FIX (CLEANS COMMON ISSUES)
// ==========================================
function cleanCode(rawCode) {
  let code = rawCode;
  
  // 1. Remove markdown code blocks
  code = code.replace(/```javascript\s*/g, '');
  code = code.replace(/```\s*/g, '');
  
  // 2. Trim whitespace
  code = code.trim();
  
  // 3. Find first "const" and cut before that
  const firstConst = code.indexOf('const {');
  if (firstConst > 0) {
    code = code.substring(firstConst);
  }
  
  // 4. Find last "});" and cut after that
  const lastBrace = code.lastIndexOf('});');
  if (lastBrace > 0 && lastBrace < code.length - 5) {
    code = code.substring(0, lastBrace + 3);
  }
  
  // 5. Ensure it has docx import
  if (!code.includes("require('docx')")) {
    const docxLine = "const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');\n";
    code = docxLine + code;
  }
  
  // 6. Ensure it has fs import
  if (!code.includes("require('fs')")) {
    const lines = code.split('\n');
    lines.splice(1, 0, "const fs = require('fs');");
    code = lines.join('\n');
  }
  
  return code;
}

// ==========================================
// MAIN CONVERSION ENDPOINT
// ==========================================
app.post('/convert', upload.single('pdf'), async (req, res) => {
  const id = crypto.randomUUID().substring(0, 8);
  const workDir = `/tmp/convert-${id}`;
  
  try {
    // Setup workspace
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(`${workDir}/outputs`, { recursive: true });
    
    console.log(`[${id}] Starting conversion`);
    console.log(`[${id}] PDF size: ${req.file.size} bytes`);
    
    // Convert PDF to base64
    const base64 = req.file.buffer.toString('base64');
    
    // Call Claude API
    console.log(`[${id}] Calling Claude API...`);
    const response = await anthropic.messages.create({
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
              data: base64
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
    
    // Extract and save raw response
    const rawCode = response.content[0].text;
    fs.writeFileSync(`${workDir}/raw.txt`, rawCode);
    console.log(`[${id}] Raw response: ${rawCode.length} chars`);
    
    // Clean the code
    let code = cleanCode(rawCode);
    fs.writeFileSync(`${workDir}/cleaned.js`, code);
    console.log(`[${id}] Cleaned code: ${code.length} chars`);
    
    // Validate
    const validation = validateCode(code);
    if (!validation.valid) {
      console.error(`[${id}] Validation failed:`, validation.issues);
      fs.writeFileSync(`${workDir}/validation_errors.txt`, validation.issues.join('\n'));
      
      throw new Error(
        `Code validation failed: ${validation.issues.join(', ')}. ` +
        `Check ${workDir}/ for debugging files.`
      );
    }
    
    console.log(`[${id}] Code validated ✓`);
    
    // Save and execute
    const scriptPath = `${workDir}/convert.js`;
    fs.writeFileSync(scriptPath, code);
    
    console.log(`[${id}] Executing conversion code...`);
    try {
      execSync(`node ${scriptPath}`, {
        cwd: workDir,
        timeout: 30000,
        stdio: 'inherit' // Show output in console
      });
    } catch (execError) {
      console.error(`[${id}] Execution error:`, execError.message);
      throw new Error(`Code execution failed: ${execError.message}`);
    }
    
    console.log(`[${id}] Execution complete ✓`);
    
    // Check for output
    const outputFiles = fs.readdirSync(`${workDir}/outputs`);
    if (outputFiles.length === 0) {
      throw new Error('No DOCX file was generated');
    }
    
    console.log(`[${id}] Output file: ${outputFiles[0]}`);
    
    // Read and send DOCX
    const docxPath = `${workDir}/outputs/${outputFiles[0]}`;
    const docxBuffer = fs.readFileSync(docxPath);
    
    console.log(`[${id}] Sending DOCX (${docxBuffer.length} bytes)`);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=converted-${id}.docx`);
    res.send(docxBuffer);
    
    console.log(`[${id}] Success! ✓`);
    
    // Cleanup after 10 seconds
    setTimeout(() => {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
        console.log(`[${id}] Cleaned up workspace`);
      } catch (e) {
        console.error(`[${id}] Cleanup failed:`, e.message);
      }
    }, 10000);
    
  } catch (error) {
    console.error(`[${id}] CONVERSION FAILED:`, error.message);
    
    // Send detailed error
    res.status(500).json({
      error: 'Conversion failed',
      message: error.message,
      sessionId: id,
      debugPath: workDir
    });
    
    // Don't delete workDir on error - keep for debugging
    console.error(`[${id}] Debug files saved at: ${workDir}`);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ PDF-to-DOCX converter running on port ${PORT}`);
  console.log(`✓ API Key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`✓ Endpoint: POST /convert`);
  console.log(`✓ Health check: GET /health`);
});
```

---

## How to Use This Fixed Version

### 1. Replace your server.js
```bash
# Backup your current version
cp server.js server.js.backup

# Copy the new code above to server.js
nano server.js
# (paste the code, save with Ctrl+X, Y, Enter)
```

### 2. Test it
```bash
# Make sure API key is set
export ANTHROPIC_API_KEY="your-key-here"

# Install dependencies (if not done)
npm install

# Start server
node server.js
```

You should see:
```
✓ PDF-to-DOCX converter running on port 3000
✓ API Key configured: true
✓ Endpoint: POST /convert
✓ Health check: GET /health
```

### 3. Test conversion
```bash
curl -X POST http://localhost:3000/convert \
  -F "pdf=@yourfile.pdf" \
  -o output.docx
```

Watch the console output:
```
[abc12345] Starting conversion
[abc12345] PDF size: 154832 bytes
[abc12345] Calling Claude API...
[abc12345] API response received
[abc12345] Raw response: 4521 chars
[abc12345] Cleaned code: 4485 chars
[abc12345] Code validated ✓
[abc12345] Executing conversion code...
Conversion complete
[abc12345] Execution complete ✓
[abc12345] Output file: converted.docx
[abc12345] Sending DOCX (25643 bytes)
[abc12345] Success! ✓
```

---

## What This Fixed Version Does Differently

### 1. **Much Better Prompt**
The new prompt is VERY explicit:
- Shows exact code structure required
- States "NO markdown" multiple times
- Specifies first and last lines
- Emphasizes "output ONLY code"

### 2. **Code Cleaning**
Automatically removes:
- Markdown code blocks (```)
- Explanatory text before code
- Explanatory text after code
- Extra whitespace

### 3. **Validation Before Execution**
Checks for:
- Required imports (docx, fs)
- Required components (Document, Packer, etc.)
- File writing logic
- Markdown blocks
- Proper structure

### 4. **Better Logging**
Shows exactly what's happening:
- Session ID for tracking
- File sizes
- Each step of the process
- Validation results
- Execution output

### 5. **Debug Files**
Saves intermediate files for inspection:
- `raw.txt` - Original API response
- `cleaned.js` - After cleaning
- `convert.js` - Final executable code
- `validation_errors.txt` - If validation fails

---

## If It Still Fails

### Check the debug files:
```bash
# Find your session directory
ls -la /tmp/convert-*/

# Look at the raw API response
cat /tmp/convert-abc12345/raw.txt

# Look at what validation found wrong
cat /tmp/convert-abc12345/validation_errors.txt

# Look at the cleaned code
cat /tmp/convert-abc12345/cleaned.js
```

### Common issues and fixes:

**Issue**: Still has markdown blocks
```bash
# Check raw.txt - if it has ```, the cleaning didn't work
# Make sure cleanCode() function is being called
```

**Issue**: Missing imports
```bash
# Check cleaned.js first few lines
# Should be:
# const { Document, ... } = require('docx');
# const fs = require('fs');
```

**Issue**: Code doesn't execute
```bash
# Try running it manually:
cd /tmp/convert-abc12345
node convert.js

# See the actual error
```

---

## Alternative: Test the Prompt Manually

You can test if the prompt is working by calling the API directly:

```javascript
// test-prompt.js
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY 
});

async function test() {
  const pdfBuffer = fs.readFileSync('test.pdf');
  
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
            data: pdfBuffer.toString('base64')
          }
        },
        {
          type: "text",
          text: "Output ONLY JavaScript code using docx library. No markdown, no explanations. Code must start with: const { Document, Packer, Paragraph, TextRun } = require('docx');"
        }
      ]
    }]
  });
  
  console.log('=== RAW API RESPONSE ===');
  console.log(message.content[0].text);
  console.log('=== END ===');
  
  // Check what we got
  const response = message.content[0].text;
  console.log('\nAnalysis:');
  console.log('- Starts with "const":', response.trim().startsWith('const'));
  console.log('- Has markdown:', response.includes('```'));
  console.log('- Has docx import:', response.includes("require('docx')"));
  console.log('- Has fs import:', response.includes("require('fs')"));
}

test().catch(console.error);
```

Run it:
```bash
node test-prompt.js
```

This will show you exactly what Claude is returning, so you can see if the prompt needs further adjustment.

---

## Key Points

1. ✅ The **improved prompt** is the most important change
2. ✅ **Code cleaning** handles markdown and extra text
3. ✅ **Validation** catches issues before execution
4. ✅ **Logging** helps you debug problems
5. ✅ **Debug files** show what went wrong

Copy the complete code above and it should work!

---

## Diagnostic Script

Not sure what's wrong? Run this diagnostic:

```bash
# Make diagnostic script executable
chmod +x diagnostic.js

# Run without PDF (tests prompt only)
node diagnostic.js

# Run with your PDF
node diagnostic.js yourfile.pdf
```

The script will:
1. ✅ Check API key is set
2. ✅ Verify dependencies are installed
3. ✅ Test API connection
4. ✅ Show you the raw response
5. ✅ Validate the generated code
6. ✅ Test code cleaning
7. ✅ Save response to files for inspection

Output example:
```
═══════════════════════════════════════════════════════════
PDF-TO-DOCX CONVERSION DIAGNOSTIC
═══════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════
1. Checking API Key
═══════════════════════════════════════════════════════════
✓ API key is set

═══════════════════════════════════════════════════════════
2. Checking Dependencies
═══════════════════════════════════════════════════════════
✓ @anthropic-ai/sdk installed
✓ docx installed

═══════════════════════════════════════════════════════════
4. Testing API Connection
═══════════════════════════════════════════════════════════
Sending test request to Claude API...
✓ API request successful
  Response time: 3247 ms
  Input tokens: 52341
  Output tokens: 4521

═══════════════════════════════════════════════════════════
6. Validating Generated Code
═══════════════════════════════════════════════════════════
✓ Starts with const
✓ Has docx import
✓ Has fs import
✓ Has Document
✓ Has Packer
✓ No markdown blocks

═══════════════════════════════════════════════════════════
DIAGNOSTIC SUMMARY
═══════════════════════════════════════════════════════════
✓ ALL CHECKS PASSED
```

This will help you see exactly what's happening!
