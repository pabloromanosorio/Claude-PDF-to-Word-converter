const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { app } = require('electron');

// Get paths
const SKILLS_PATH = path.join(__dirname, 'skills');
const PROMPTS_PATH = path.join(__dirname, 'prompts');

/**
 * Load master prompt with skills integration
 */
function loadMasterPrompt(settings, outputPath, fileName) {
  const masterPrompt = fs.readFileSync(
    path.join(PROMPTS_PATH, 'master-prompt.txt'),
    'utf-8'
  );
  
  // Build enhanced prompt with settings
  const enhancedPrompt = `
${masterPrompt}

---

## APPLICATION SETTINGS

**Output Configuration:**
- Save file to: ${outputPath}/${fileName}.docx
- Font: ${settings.font}
- Font Size: ${settings.fontSize}pt (${settings.fontSize * 2} in half-points)
- Margins: ${settings.margins.top / 1440}" (all sides)

**Special Requests:**
${settings.specialRequests.replaceSignatures ? '- ✅ Replace signatures with [Signature]' : '- ❌ Keep signature images as-is'}
${settings.specialRequests.addPageMarkers ? '- ✅ Add [Page X of the original] markers (except page 1)' : '- ❌ Do not add page markers'}

**Skills Documentation Available:**
You have access to the following documentation for reference:
- ${path.join(SKILLS_PATH, 'docx/SKILL.md')}
- ${path.join(SKILLS_PATH, 'docx/docx-js.md')}
- ${path.join(SKILLS_PATH, 'pdf/SKILL.md')}

Read these files before generating code if needed for clarification.

---

## CODE GENERATION INSTRUCTIONS

**CRITICAL: Return ONLY executable JavaScript code.**

1. Generate complete, runnable Node.js code using docx.js
2. Include ALL necessary require() statements
3. Include file I/O (fs.writeFileSync)
4. Wrap code in \`\`\`javascript code blocks
5. Print "SUCCESS: ${fileName}.docx" when complete
6. Handle errors with try/catch
7. Exit with process.exit(0) on success, process.exit(1) on error

**Example code structure:**
\`\`\`javascript
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak } = require('docx');

try {
  // Your document creation code here
  const doc = new Document({
    creator: "",
    description: "",
    title: "",
    // ... document structure
  });
  
  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync('${outputPath}/${fileName}.docx', buffer);
    console.log('SUCCESS: ${fileName}.docx');
    process.exit(0);
  }).catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
\`\`\`

**Now generate the code for this document.**
`;

  return enhancedPrompt;
}

/**
 * Convert file to base64 for API
 */
function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

/**
 * Determine media type from file extension
 */
function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };
  return types[ext] || 'application/pdf';
}

/**
 * Extract JavaScript code from Claude's response
 */
function extractCode(responseText) {
  // Find code blocks
  const codeBlockRegex = /```javascript\n([\s\S]*?)\n```/g;
  const matches = [...responseText.matchAll(codeBlockRegex)];
  
  if (matches.length === 0) {
    // Try without language specifier
    const genericCodeRegex = /```\n([\s\S]*?)\n```/g;
    const genericMatches = [...responseText.matchAll(genericCodeRegex)];
    
    if (genericMatches.length > 0) {
      return genericMatches.map(m => m[1]).join('\n\n');
    }
    
    throw new Error('No code blocks found in response');
  }
  
  // Combine all code blocks
  return matches.map(m => m[1]).join('\n\n');
}

/**
 * Execute generated code
 */
async function executeCode(code, tempDir, fileName, progressCallback) {
  const codePath = path.join(tempDir, `${fileName}_converter.js`);

  // Write code to temp file
  fs.writeFileSync(codePath, code);

  console.log(`[DEBUG] Executing code from: ${codePath}`);
  console.log(`[DEBUG] Generated code:\n${code.substring(0, 500)}...`);

  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');

    // Set NODE_PATH to include the project's node_modules
    const projectNodeModules = path.join(__dirname, 'node_modules');
    const env = {
      ...process.env,
      NODE_PATH: projectNodeModules
    };

    const nodeProcess = spawn('node', [codePath], { env });

    let stdout = '';
    let stderr = '';

    nodeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[STDOUT] ${output}`);

      // Check for success message
      if (output.includes('SUCCESS:')) {
        progressCallback({
          status: 'complete',
          progress: 100
        });
      }
    });

    nodeProcess.stderr.on('data', (data) => {
      const errOutput = data.toString();
      stderr += errOutput;
      console.error(`[STDERR] ${errOutput}`);
    });

    nodeProcess.on('close', (exitCode) => {
      console.log(`[DEBUG] Process exited with code: ${exitCode}`);
      console.log(`[DEBUG] Full stdout: ${stdout}`);
      console.log(`[DEBUG] Full stderr: ${stderr}`);

      // Don't clean up temp file immediately for debugging
      // try {
      //   fs.unlinkSync(codePath);
      // } catch (e) {
      //   // Ignore cleanup errors
      // }

      if (exitCode === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(`Code execution failed (exit code ${exitCode}):\nSTDERR: ${stderr}\nSTDOUT: ${stdout}`));
      }
    });
  });
}

/**
 * Main conversion function
 */
async function convertFile(filePath, fileName, settings, apiKey, progressCallback) {
  const client = new Anthropic({ apiKey });
  const tempDir = path.join(app.getPath('temp'), 'pdf-converter');

  // Use the same directory as the input file
  const outputDir = path.dirname(filePath);

  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // Step 1: Prepare file
    progressCallback({ status: 'preparing', progress: 10 });

    const fileBase64 = fileToBase64(filePath);
    const mediaType = getMediaType(filePath);
    const masterPrompt = loadMasterPrompt(settings, outputDir, fileName);
    
    // Step 2: Send to Claude
    progressCallback({ status: 'analyzing', progress: 30 });
    
    const response = await client.messages.create({
      model: settings.model,
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: fileBase64
            }
          },
          {
            type: 'text',
            text: masterPrompt
          }
        ]
      }]
    });
    
    // Step 3: Extract code
    progressCallback({ status: 'generating code', progress: 60 });
    
    const responseText = response.content[0].text;
    const code = extractCode(responseText);
    
    // Step 4: Execute code
    progressCallback({ status: 'creating document', progress: 80 });

    await executeCode(code, tempDir, fileName, progressCallback);

    const outputPath = path.join(outputDir, `${fileName}.docx`);

    // Verify file was created
    if (fs.existsSync(outputPath)) {
      console.log(`[SUCCESS] File created at: ${outputPath}`);
      const stats = fs.statSync(outputPath);
      console.log(`[SUCCESS] File size: ${stats.size} bytes`);
    } else {
      console.error(`[ERROR] File not found at expected location: ${outputPath}`);
      throw new Error(`Output file not created at: ${outputPath}`);
    }

    return {
      success: true,
      fileName: `${fileName}.docx`,
      outputPath: outputPath
    };
    
  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

module.exports = {
  convertFile
};
