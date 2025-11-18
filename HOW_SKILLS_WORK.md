# How Claude Skills Actually Work

## Important Clarification

**Yes, Claude DOES generate code when using skills!**

The key difference is **WHERE the code executes**:

---

## ❌ Old Approach (WRONG)

**Local Code Execution:**

```javascript
// 1. Ask Claude to generate JavaScript code
const prompt = "Read skill docs and generate JavaScript using docx library";
const response = await claude.messages.create({...});

// 2. Extract the generated code
const code = response.content[0].text;

// 3. Execute code LOCALLY on our server
execSync(`node convert.js`, { cwd: workDir }); // ← RUNS ON OUR MACHINE

// 4. Hope it works (often had syntax errors!)
```

**Problems:**
- ❌ Claude generated code with syntax errors (`SyntaxError: Unexpected token ']'`)
- ❌ We executed broken code locally
- ❌ No isolation or safety
- ❌ Unreliable

---

## ✅ New Approach (CORRECT)

**Remote Code Execution (in Claude's Environment):**

```javascript
// 1. Upload file to Claude
const fileUpload = await anthropic.beta.files.upload({
  file: fs.createReadStream(pdfPath),
  purpose: 'user_upload',
  betas: ['files-api-2025-04-14']
});

// 2. Call Claude with docx skill enabled
const response = await anthropic.beta.messages.create({
  betas: [
    'code-execution-2025-08-25',  // ← Code execution in Claude's environment
    'skills-2025-10-02',           // ← Skills API
    'files-api-2025-04-14'         // ← Files API
  ],
  container: {
    skills: [{
      type: 'anthropic',
      skill_id: 'docx',  // ← docx skill provides the library
      version: 'latest'
    }]
  },
  tools: [{
    type: 'code_execution_20250825',
    name: 'code_execution'  // ← Claude executes code in its own sandbox
  }]
});

// 3. Claude:
//    - Reads the PDF
//    - Generates Python/JavaScript code using docx library
//    - EXECUTES the code in its own secure sandbox
//    - Returns the generated file

// 4. We just download the result
const fileId = extractFileId(response);
const fileContent = await anthropic.beta.files.download({ file_id: fileId });
```

**Benefits:**
- ✅ Claude generates AND executes code (in its environment)
- ✅ No local code execution needed
- ✅ Reliable and secure
- ✅ Same approach as Python backend

---

## What Happens Behind the Scenes

### With Skills API:

```
User uploads PDF
    ↓
Claude receives PDF + prompt
    ↓
Claude reads PDF content
    ↓
Claude generates code (Python/JavaScript using docx library)
    ↓
Claude EXECUTES code in secure sandbox  ← KEY DIFFERENCE!
    ↓
Code creates DOCX file
    ↓
Claude returns file_id
    ↓
User downloads DOCX
```

### Old Local Execution:

```
User uploads PDF
    ↓
Claude receives PDF + prompt
    ↓
Claude generates JavaScript code
    ↓
WE try to execute code locally  ← PROBLEM!
    ↓
Code has syntax errors
    ↓
CRASH: SyntaxError
```

---

## Code Generation is Not the Problem

**Code generation is FINE when:**
- ✅ Claude generates the code
- ✅ Claude executes the code (in its sandbox)
- ✅ We just download the result

**Code generation is BROKEN when:**
- ❌ Claude generates the code
- ❌ WE try to execute it locally
- ❌ Code has errors or doesn't work

---

## Python Backend Uses Same Approach

The Python backend (port 8000) uses **exactly the same approach**:

```python
response = self.client.beta.messages.create(
    betas=[
        'code-execution-2025-08-25',  # Claude executes code
        'skills-2025-10-02',           # Skills API
        'files-api-2025-04-14'         # Files API
    ],
    container={
        'skills': [{
            'type': 'anthropic',
            'skill_id': 'docx',
            'version': 'latest'
        }]
    },
    tools=[{
        'type': 'code_execution_20250825',
        'name': 'code_execution'  # Same as Node.js!
    }]
)

# Claude generates and executes code remotely
# We just download the result
file_ids = self.file_extractor.extract_file_ids(response)
output_path = self._download_file(file_id, file_path)
```

---

## Summary

| Aspect | Old (Local Exec) | New (Remote Exec) |
|--------|------------------|-------------------|
| **Who generates code?** | Claude | Claude |
| **Where code runs?** | Our server ❌ | Claude's sandbox ✅ |
| **Reliability** | Low (syntax errors) | High (tested by Anthropic) |
| **Security** | Poor (arbitrary code) | Good (isolated sandbox) |
| **Maintenance** | We fix code errors | Anthropic maintains it |

---

## Why the Rewrite Was Necessary

The fundamental mistake was trying to **execute Claude's generated code locally**:

1. We asked Claude to generate JavaScript
2. We saved it to a file
3. We ran `execSync('node convert.js')` on our server
4. Code had syntax errors → crash

**The fix:**
1. Let Claude generate code
2. Let Claude execute code (in its environment)
3. We just download the result

This is what the Skills API + code execution tools are designed for!

---

## Both Backends Now Use This Approach

✅ **Node.js (port 3000)**: Skills API + remote code execution
✅ **Python (port 8000)**: Skills API + remote code execution

Both are reliable and production-ready!
