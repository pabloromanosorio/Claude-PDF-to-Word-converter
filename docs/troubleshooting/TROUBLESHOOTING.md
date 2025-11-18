# Troubleshooting: Code Generation Issues

## Common Problem: Missing Docx Imports

### Error Message
```
Conversion failed: Invalid code generated - missing required docx imports
```

### Root Cause
Claude's response either:
1. Includes markdown formatting (```javascript blocks)
2. Includes explanatory text before/after code
3. Doesn't include complete imports
4. Returns invalid JavaScript syntax

---

## Solution 1: Improved Prompt (MOST IMPORTANT)

Replace your conversion prompt with this proven template:

```javascript
function getConversionPrompt(outputPath) {
  return `You are a code generator. Your ONLY job is to output executable JavaScript code.

TASK: Convert the attached PDF document to DOCX format using the docx npm library.

CRITICAL REQUIREMENTS:
1. Output MUST start with: const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
2. Output MUST include: const fs = require('fs');
3. Output MUST end with: Packer.toBuffer(doc).then(buffer => { fs.writeFileSync('${outputPath}', buffer); console.log('Done'); });
4. NO markdown code blocks (no \`\`\`javascript or \`\`\`)
5. NO explanatory text before or after the code
6. NO comments explaining what the code does
7. ONLY output raw, executable JavaScript code

STEPS:
1. Read /mnt/skills/public/docx/SKILL.md completely
2. Read /mnt/skills/public/docx/docx-js.md completely
3. Analyze the PDF structure
4. Generate code that:
   - Creates Document with sections
   - Uses Paragraph and TextRun for text
   - Uses Table, TableRow, TableCell for tables
   - Applies borders with BorderStyle.SINGLE
   - Uses ShadingType.CLEAR for table headers
   - Sets proper margins and spacing
5. Save to ${outputPath}

EXAMPLE OUTPUT FORMAT (your code should look like this):
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');
const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun("Content here")] })
    ]
  }]
});
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Done');
});

Remember: Output ONLY the JavaScript code, nothing else!`;
}
```

---

## Solution 2: Better Code Validation

Add validation BEFORE executing the code:

```javascript
function validateGeneratedCode(code) {
  const errors = [];
  
  // Check 1: Has docx imports
  if (!code.includes("require('docx')")) {
    errors.push("Missing docx library import");
  }
  
  // Check 2: Has required components
  const requiredComponents = ['Document', 'Packer', 'Paragraph'];
  requiredComponents.forEach(component => {
    if (!code.includes(component)) {
      errors.push(`Missing required component: ${component}`);
    }
  });
  
  // Check 3: Has fs import
  if (!code.includes("require('fs')")) {
    errors.push("Missing fs (filesystem) import");
  }
  
  // Check 4: Has file writing logic
  if (!code.includes('writeFileSync') && !code.includes('writeFile')) {
    errors.push("Missing file write operation");
  }
  
  // Check 5: No markdown code blocks
  if (code.includes('```')) {
    errors.push("Contains markdown code blocks - needs cleaning");
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// Usage
app.post('/convert', upload.single('pdf'), async (req, res) => {
  try {
    // ... get code from API ...
    
    // Validate before executing
    const validation = validateGeneratedCode(code);
    
    if (!validation.valid) {
      console.error('Invalid code generated:', validation.errors);
      
      // Try to fix automatically (see Solution 3)
      code = autoFixCode(code);
      
      // Validate again
      const revalidation = validateGeneratedCode(code);
      if (!revalidation.valid) {
        throw new Error('Invalid code: ' + validation.errors.join(', '));
      }
    }
    
    // Now safe to execute
    // ...
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Solution 3: Auto-Fix Common Issues

```javascript
function autoFixCode(code) {
  let fixed = code;
  
  // Remove markdown code blocks
  fixed = fixed.replace(/```javascript\n?/g, '');
  fixed = fixed.replace(/```\n?/g, '');
  fixed = fixed.trim();
  
  // Remove explanatory text before code
  // Look for the first "const" or "require" and start from there
  const codeStart = fixed.search(/\b(const|require|import)\b/);
  if (codeStart > 0) {
    fixed = fixed.substring(codeStart);
  }
  
  // Remove explanatory text after code
  // Look for the last "});" and cut after that
  const lastClosing = fixed.lastIndexOf('});');
  if (lastClosing > 0) {
    fixed = fixed.substring(0, lastClosing + 3);
  }
  
  // If missing docx import, add it
  if (!fixed.includes("require('docx')")) {
    const docxImport = `const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');\n`;
    fixed = docxImport + fixed;
  }
  
  // If missing fs import, add it
  if (!fixed.includes("require('fs')")) {
    const fsImport = `const fs = require('fs');\n`;
    // Add after docx import
    const docxImportEnd = fixed.indexOf('\n') + 1;
    fixed = fixed.slice(0, docxImportEnd) + fsImport + fixed.slice(docxImportEnd);
  }
  
  return fixed;
}
```

---

## Solution 4: Enhanced Error Handling

```javascript
app.post('/convert', upload.single('pdf'), async (req, res) => {
  const sessionId = crypto.randomUUID();
  const workDir = `/tmp/work-${sessionId}`;
  
  try {
    // Setup
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(`${workDir}/outputs`, { recursive: true });
    
    console.log(`[${sessionId}] Starting conversion`);
    
    // Call API
    const base64Pdf = req.file.buffer.toString('base64');
    console.log(`[${sessionId}] Calling Claude API...`);
    
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
              data: base64Pdf
            }
          },
          {
            type: "text",
            text: getConversionPrompt(`${workDir}/outputs/converted.docx`)
          }
        ]
      }]
    });
    
    console.log(`[${sessionId}] API response received`);
    
    // Extract code
    let code = message.content[0].text;
    console.log(`[${sessionId}] Raw code length: ${code.length} characters`);
    
    // Save raw response for debugging
    fs.writeFileSync(`${workDir}/raw_response.txt`, code);
    
    // Auto-fix common issues
    code = autoFixCode(code);
    console.log(`[${sessionId}] Fixed code length: ${code.length} characters`);
    
    // Validate
    const validation = validateGeneratedCode(code);
    if (!validation.valid) {
      console.error(`[${sessionId}] Validation failed:`, validation.errors);
      
      // Save for manual inspection
      fs.writeFileSync(`${workDir}/invalid_code.js`, code);
      
      throw new Error(
        `Invalid code generated: ${validation.errors.join(', ')}. ` +
        `Check ${workDir}/invalid_code.js for details.`
      );
    }
    
    console.log(`[${sessionId}] Code validated successfully`);
    
    // Save and execute
    const scriptPath = `${workDir}/convert.js`;
    fs.writeFileSync(scriptPath, code);
    
    console.log(`[${sessionId}] Executing code...`);
    execSync(`node ${scriptPath}`, {
      cwd: workDir,
      timeout: 30000,
      stdio: 'pipe' // Capture output
    });
    
    console.log(`[${sessionId}] Code executed successfully`);
    
    // Check output
    const outputFiles = fs.readdirSync(`${workDir}/outputs`);
    if (outputFiles.length === 0) {
      throw new Error('No output file generated');
    }
    
    console.log(`[${sessionId}] Output file: ${outputFiles[0]}`);
    
    // Read and send
    const docxPath = `${workDir}/outputs/${outputFiles[0]}`;
    const docxBuffer = fs.readFileSync(docxPath);
    
    console.log(`[${sessionId}] Conversion successful, sending file`);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=converted_${sessionId}.docx`);
    res.send(docxBuffer);
    
    // Cleanup
    setTimeout(() => {
      fs.rmSync(workDir, { recursive: true, force: true });
      console.log(`[${sessionId}] Cleanup completed`);
    }, 5000);
    
  } catch (error) {
    console.error(`[${sessionId}] Conversion failed:`, error.message);
    console.error(`[${sessionId}] Stack trace:`, error.stack);
    
    res.status(500).json({
      error: 'Conversion failed',
      message: error.message,
      sessionId: sessionId
    });
    
    // Keep workDir for debugging
    console.error(`[${sessionId}] Work directory preserved for debugging: ${workDir}`);
  }
});
```

---

## Solution 5: Fallback Template

If Claude keeps failing, use a template approach:

```javascript
function createFallbackCode(extractedText, outputPath) {
  return `const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');

// Extracted text from PDF
const content = ${JSON.stringify(extractedText)};

// Create document
const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 720, right: 720, bottom: 720, left: 720 }
      }
    },
    children: content.split('\\n').map(line => 
      new Paragraph({
        children: [new TextRun(line || ' ')]
      })
    )
  }]
});

// Save
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Done');
});`;
}

// Use as fallback
try {
  // Try Claude API first
  code = await getCodeFromClaude(pdf);
  
  // Validate
  if (!validateGeneratedCode(code).valid) {
    throw new Error('Invalid code');
  }
  
} catch (error) {
  console.warn('Claude generation failed, using fallback template');
  
  // Extract text with pdfjs or similar
  const text = await extractTextFromPdf(pdfBuffer);
  
  // Use simple template
  code = createFallbackCode(text, outputPath);
}
```

---

## Debugging Checklist

When you get "Invalid code generated" error:

### Step 1: Check the Raw Response
```javascript
console.log('Raw API response:', message.content[0].text);
```

Look for:
- [ ] Does it start with `const {`?
- [ ] Does it have markdown blocks (```)?
- [ ] Is there explanatory text before the code?
- [ ] Is there explanatory text after the code?

### Step 2: Check the Prompt
- [ ] Does your prompt say "Output ONLY code"?
- [ ] Does it mention "NO markdown blocks"?
- [ ] Does it specify required imports?
- [ ] Is temperature set to 0.3 or lower?

### Step 3: Check API Configuration
```javascript
{
  model: "claude-sonnet-4-20250514",  // ✓ Correct model
  max_tokens: 16000,                  // ✓ Enough for code
  temperature: 0.3,                   // ✓ Low for consistency
  messages: [...]
}
```

### Step 4: Inspect Saved Files
```bash
ls /tmp/work-*/
# Should see:
# - raw_response.txt  (original API response)
# - convert.js        (cleaned code)
# - outputs/          (generated files)
```

---

## Complete Working Example

Here's a tested, working implementation:

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

// IMPROVED PROMPT
function getConversionPrompt(outputPath) {
  return `You are a JavaScript code generator. Output ONLY executable code.

TASK: Convert PDF to DOCX using the docx library.

REQUIRED FORMAT:
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

// Your code here to build the document

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Done');
});

RULES:
- Read /mnt/skills/public/docx/SKILL.md completely
- Read /mnt/skills/public/docx/docx-js.md completely
- NO markdown (no \`\`\`)
- NO explanatory text
- ONLY JavaScript code
- MUST start with require('docx')
- MUST end with writeFileSync

Output the code now:`;
}

// VALIDATION
function validateGeneratedCode(code) {
  const checks = [
    { test: code.includes("require('docx')"), error: "Missing docx import" },
    { test: code.includes('Document'), error: "Missing Document" },
    { test: code.includes('Packer'), error: "Missing Packer" },
    { test: code.includes("require('fs')"), error: "Missing fs import" },
    { test: code.includes('writeFileSync'), error: "Missing writeFileSync" },
    { test: !code.includes('```'), error: "Contains markdown blocks" }
  ];
  
  const errors = checks.filter(c => !c.test).map(c => c.error);
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// AUTO-FIX
function autoFixCode(code) {
  let fixed = code;
  
  // Remove markdown
  fixed = fixed.replace(/```javascript\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Extract just the code portion
  const codeStart = fixed.search(/\bconst\s+{.*require\s*\(\s*['"]docx['"]\s*\)/);
  if (codeStart > 0) {
    fixed = fixed.substring(codeStart);
  }
  
  // Find last closing
  const lastClosing = fixed.lastIndexOf('});');
  if (lastClosing > 0 && lastClosing < fixed.length - 10) {
    fixed = fixed.substring(0, lastClosing + 3);
  }
  
  // Add missing imports if needed
  if (!fixed.includes("require('docx')")) {
    fixed = `const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');\n` + fixed;
  }
  
  if (!fixed.includes("require('fs')")) {
    const lines = fixed.split('\n');
    lines.splice(1, 0, `const fs = require('fs');`);
    fixed = lines.join('\n');
  }
  
  return fixed;
}

// MAIN ENDPOINT
app.post('/convert', upload.single('pdf'), async (req, res) => {
  const sessionId = crypto.randomUUID();
  const workDir = `/tmp/work-${sessionId}`;
  
  try {
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(`${workDir}/outputs`, { recursive: true });
    
    console.log(`[${sessionId}] Starting conversion`);
    
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
    
    // Process response
    let code = message.content[0].text;
    fs.writeFileSync(`${workDir}/raw.txt`, code); // Save for debugging
    
    code = autoFixCode(code);
    
    const validation = validateGeneratedCode(code);
    if (!validation.valid) {
      fs.writeFileSync(`${workDir}/invalid.js`, code);
      throw new Error(`Invalid code: ${validation.errors.join(', ')}`);
    }
    
    // Execute
    fs.writeFileSync(`${workDir}/convert.js`, code);
    execSync(`node convert.js`, { cwd: workDir, timeout: 30000 });
    
    // Return result
    const files = fs.readdirSync(`${workDir}/outputs`);
    const docx = fs.readFileSync(`${workDir}/outputs/${files[0]}`);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=converted.docx');
    res.send(docx);
    
    setTimeout(() => fs.rmSync(workDir, { recursive: true }), 5000);
    
  } catch (error) {
    console.error(`[${sessionId}] Error:`, error.message);
    res.status(500).json({ error: error.message, sessionId });
  }
});

app.listen(3000, () => console.log('Server ready on port 3000'));
```

---

## Testing Your Fix

```bash
# 1. Check if docx is installed
npm list docx

# 2. Test code generation manually
node -e "console.log(require('docx'))"

# 3. Test with a simple PDF
curl -X POST http://localhost:3000/convert \
  -F "pdf=@test.pdf" \
  -o output.docx

# 4. Check logs
# Should see: [session-id] Starting conversion
#            [session-id] Code validated successfully
#            [session-id] Conversion successful
```

---

## Key Takeaways

1. **Use the improved prompt** - It's MUCH more explicit
2. **Validate before executing** - Catch issues early
3. **Auto-fix common problems** - Remove markdown, trim text
4. **Log everything** - Essential for debugging
5. **Save intermediate files** - Inspect when things fail

The improved prompt is the most important fix - it tells Claude exactly what format you need.
