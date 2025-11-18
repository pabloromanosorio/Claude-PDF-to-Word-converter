# Visual Debugging Guide

## Understanding What Went Wrong

Your error: **"Invalid code generated - missing required docx imports"**

Let's see exactly what this means and how to fix it.

---

## What Claude Should Return (GOOD ✓)

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

const doc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } }
    },
    children: [
      new Paragraph({
        children: [new TextRun("Sample content from PDF")]
      }),
      new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun("Cell")] })]
              })
            ]
          })
        ]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/path/to/output.docx', buffer);
  console.log('Conversion complete');
});
```

**Why this is good:**
- ✅ Starts with `const { Document, Packer... } = require('docx');`
- ✅ Has `const fs = require('fs');`
- ✅ Creates Document with sections and children
- ✅ Ends with Packer.toBuffer() and writeFileSync()
- ✅ No markdown blocks
- ✅ No explanatory text

---

## What Claude Might Return (BAD ✗)

### Problem 1: Markdown Code Blocks

```markdown
Here's the code to convert your PDF:

```javascript
const { Document, Packer } = require('docx');
const fs = require('fs');

const doc = new Document({...});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('output.docx', buffer);
});
```

This code will create a DOCX file from your PDF.
```

**What's wrong:**
- ✗ Has markdown code blocks (```javascript and ```)
- ✗ Has explanatory text before and after code
- ✗ Can't be executed directly

**How to detect:**
```javascript
if (code.includes('```')) {
  console.log('❌ Has markdown blocks');
}
```

**How to fix:**
```javascript
code = code.replace(/```javascript\n?/g, '');
code = code.replace(/```\n?/g, '');
code = code.trim();
```

---

### Problem 2: Explanatory Text Mixed With Code

```
I'll create a conversion script for you. First, I'll import the necessary libraries:

const { Document, Packer } = require('docx');
const fs = require('fs');

Next, I'll build the document structure:

const doc = new Document({
  sections: [{
    children: [...]
  }]
});

Finally, I'll save the file:

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('output.docx', buffer);
});

This code will convert your PDF to DOCX format.
```

**What's wrong:**
- ✗ Has explanatory sentences mixed with code
- ✗ Not valid JavaScript
- ✗ Will cause syntax errors

**How to detect:**
```javascript
// Code shouldn't have sentences explaining what it does
if (/I'll|Next|Finally|This code will/.test(code)) {
  console.log('❌ Has explanatory text');
}
```

**How to fix:**
```javascript
// Find first "const" and cut everything before it
const firstConst = code.indexOf('const {');
if (firstConst > 0) {
  code = code.substring(firstConst);
}

// Find last "});" and cut everything after it
const lastBrace = code.lastIndexOf('});');
if (lastBrace > 0) {
  code = code.substring(0, lastBrace + 3);
}
```

---

### Problem 3: Missing Imports

```javascript
// Missing the docx import!
const fs = require('fs');

const doc = new Document({  // ❌ Document is not defined
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun("text")] })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('output.docx', buffer);
});
```

**What's wrong:**
- ✗ Missing `require('docx')` import
- ✗ Document, Paragraph, TextRun, Packer are all undefined
- ✗ Will crash immediately

**How to detect:**
```javascript
if (!code.includes("require('docx')")) {
  console.log('❌ Missing docx import');
}
```

**How to fix:**
```javascript
if (!code.includes("require('docx')")) {
  const docxImport = `const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');\n`;
  code = docxImport + code;
}
```

---

### Problem 4: Incomplete Imports

```javascript
const { Document, Packer } = require('docx');  // ❌ Missing components
const fs = require('fs');

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({  // ❌ Paragraph is not defined
        children: [
          new TextRun("text")  // ❌ TextRun is not defined
        ]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('output.docx', buffer);
});
```

**What's wrong:**
- ✗ Import only includes Document and Packer
- ✗ Missing Paragraph, TextRun, Table, etc.
- ✗ Will crash when trying to use missing components

**How to detect:**
```javascript
const required = ['Document', 'Packer', 'Paragraph', 'TextRun'];
const missing = required.filter(comp => !code.includes(comp));
if (missing.length > 0) {
  console.log('❌ Missing components:', missing);
}
```

**How to fix:**
```javascript
// Replace incomplete import with complete one
if (code.includes("require('docx')") && !code.includes('TableCell')) {
  code = code.replace(
    /const\s+{[^}]+}\s+=\s+require\(['"]docx['"]\);/,
    `const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');`
  );
}
```

---

## Real-World Example

Let's trace what happens with a problematic response:

### Step 1: API Returns This
```
I'll help you convert that PDF to DOCX. Here's the code:

```javascript
const { Document, Packer } = require('docx');
const fs = require('fs');

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun("Content")] })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/tmp/output.docx', buffer);
});
```

This will create your DOCX file.
```

### Step 2: Your Code Tries to Execute
```javascript
// Save response to file
fs.writeFileSync('/tmp/convert.js', apiResponse);

// Try to run it
execSync('node /tmp/convert.js');
```

### Step 3: Node.js Errors
```
/tmp/convert.js:1
I'll help you convert that PDF to DOCX. Here's the code:
^^^^

SyntaxError: Unexpected identifier
```

**Why:** The first line isn't valid JavaScript!

### Step 4: What Should Happen Instead

```javascript
// Clean the response
let code = apiResponse;

// Remove markdown
code = code.replace(/```javascript\n?/g, '');
code = code.replace(/```\n?/g, '');

// Find first valid code line
const codeStart = code.indexOf('const {');
if (codeStart > 0) {
  code = code.substring(codeStart);
}

// Find last valid code line
const codeEnd = code.lastIndexOf('});');
if (codeEnd > 0) {
  code = code.substring(0, codeEnd + 3);
}

// Validate before saving
if (!code.includes("require('docx')")) {
  throw new Error('Missing docx import');
}

// Now it's safe
fs.writeFileSync('/tmp/convert.js', code);
execSync('node /tmp/convert.js');
```

---

## Debugging Checklist

When you get the error, check these in order:

### ✓ Check 1: Raw API Response
```javascript
console.log('RAW RESPONSE:');
console.log(apiResponse);
console.log('---');
```

**Look for:**
- [ ] Does it have ```javascript or ``` ?
- [ ] Does it have sentences before the code?
- [ ] Does it have sentences after the code?

### ✓ Check 2: After Cleaning
```javascript
const cleaned = cleanCode(apiResponse);
console.log('CLEANED CODE:');
console.log(cleaned);
console.log('---');
```

**Look for:**
- [ ] First line is `const { ... } = require('docx');` ?
- [ ] Has `const fs = require('fs');` ?
- [ ] No more explanatory text?

### ✓ Check 3: Validation
```javascript
const validation = validateCode(cleaned);
console.log('VALIDATION:');
console.log('Valid:', validation.valid);
console.log('Issues:', validation.issues);
console.log('---');
```

**Should show:**
- [ ] Valid: true
- [ ] Issues: [] (empty array)

### ✓ Check 4: Components
```javascript
// Check what's imported
const importMatch = cleaned.match(/const\s+{([^}]+)}\s+=\s+require\(['"]docx['"]\)/);
if (importMatch) {
  const components = importMatch[1].split(',').map(s => s.trim());
  console.log('IMPORTED COMPONENTS:', components);
}
```

**Should include:**
- [ ] Document
- [ ] Packer
- [ ] Paragraph
- [ ] TextRun
- [ ] Table (if PDF has tables)
- [ ] TableRow (if PDF has tables)
- [ ] TableCell (if PDF has tables)

---

## Quick Test

Run this to see what you're getting:

```javascript
// test.js
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function test() {
  const pdf = fs.readFileSync('sample.pdf');
  
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    temperature: 0.3,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString('base64') }},
        { type: "text", text: "Output ONLY JavaScript code. First line must be: const { Document, Packer, Paragraph, TextRun } = require('docx');" }
      ]
    }]
  });
  
  const response = message.content[0].text;
  
  console.log('═══════════════════════════════════════');
  console.log('RAW RESPONSE:');
  console.log('═══════════════════════════════════════');
  console.log(response);
  console.log('\n═══════════════════════════════════════');
  console.log('ANALYSIS:');
  console.log('═══════════════════════════════════════');
  console.log('Length:', response.length);
  console.log('Has markdown:', response.includes('```'));
  console.log('Starts with const:', response.trim().startsWith('const'));
  console.log('Has docx import:', response.includes("require('docx')"));
  console.log('Has fs import:', response.includes("require('fs')"));
  console.log('Has Document:', response.includes('Document'));
  console.log('Has Packer:', response.includes('Packer'));
  console.log('Has writeFileSync:', response.includes('writeFileSync'));
}

test().catch(console.error);
```

Run: `node test.js`

This will show you EXACTLY what Claude returns and what's wrong with it.

---

## Summary: The Fix

Your code should do this:

```javascript
// 1. Get response from Claude
const rawCode = message.content[0].text;

// 2. Clean it
let code = rawCode
  .replace(/```javascript\n?/g, '')
  .replace(/```\n?/g, '')
  .trim();

// Find code start
const start = code.indexOf('const {');
if (start > 0) code = code.substring(start);

// Find code end  
const end = code.lastIndexOf('});');
if (end > 0) code = code.substring(0, end + 3);

// 3. Ensure imports
if (!code.includes("require('docx')")) {
  code = `const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');\n` + code;
}

if (!code.includes("require('fs')")) {
  const lines = code.split('\n');
  lines.splice(1, 0, `const fs = require('fs');`);
  code = lines.join('\n');
}

// 4. Validate
const hasDocx = code.includes("require('docx')");
const hasFs = code.includes("require('fs')");
const hasDocument = code.includes('Document');
const hasPacker = code.includes('Packer');

if (!hasDocx || !hasFs || !hasDocument || !hasPacker) {
  throw new Error('Code is still invalid after cleaning');
}

// 5. NOW it's safe to execute
fs.writeFileSync('convert.js', code);
execSync('node convert.js');
```

The key is: **clean, validate, THEN execute**.
