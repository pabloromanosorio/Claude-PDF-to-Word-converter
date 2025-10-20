const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { app } = require('electron');

// Get paths
const SKILLS_PATH = path.join(__dirname, 'skills');
const PROMPTS_PATH = path.join(__dirname, 'prompts');

// Model pricing (per million tokens)
const MODEL_PRICING = {
  'claude-haiku-4-5': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 }
};

/**
 * Load prompt based on mode (advanced, simple, or custom)
 */
function loadMasterPrompt(settings, outputPath, fileName) {
  let basePrompt;

  // Load appropriate prompt file based on mode
  if (settings.promptMode === 'custom') {
    // Custom prompt should be passed in settings.customPrompt
    basePrompt = settings.customPrompt || fs.readFileSync(
      path.join(PROMPTS_PATH, 'basic-prompt.txt'),
      'utf-8'
    );
  } else if (settings.promptMode === 'advanced') {
    basePrompt = fs.readFileSync(
      path.join(PROMPTS_PATH, 'master-prompt.txt'),
      'utf-8'
    );
  } else {
    // Default to simple
    basePrompt = fs.readFileSync(
      path.join(PROMPTS_PATH, 'basic-prompt.txt'),
      'utf-8'
    );
  }

  // Build skills documentation reference (only for advanced mode)
  let skillsSection = '';
  if (settings.promptMode === 'advanced') {
    skillsSection = `

**Skills Documentation Available:**
You have access to the following documentation for reference:
- ${path.join(SKILLS_PATH, 'docx/SKILL.md')}
- ${path.join(SKILLS_PATH, 'docx/docx-js.md')}
- ${path.join(SKILLS_PATH, 'pdf/SKILL.md')}

Read these files before generating code if needed for clarification.
`;
  }

  // Build enhanced prompt with settings
  const enhancedPrompt = `
${basePrompt}

---

## APPLICATION SETTINGS

**Output Configuration:**
- Save file to: ${outputPath}/${fileName}.docx
- Font: ${settings.font}
- Font Size: ${settings.fontSize}pt (${settings.fontSize * 2} in half-points)
- Margins: Top ${settings.margins.top / 1440}", Right ${settings.margins.right / 1440}", Bottom ${settings.margins.bottom / 1440}", Left ${settings.margins.left / 1440}"

**Special Requests:**
${settings.specialRequests.replaceSignatures ? '- ✅ Replace signatures with [Signature]' : '- ❌ Keep signature images as-is'}
${settings.specialRequests.addPageMarkers ? '- ✅ Add [Page X of the original] markers (except page 1)' : '- ❌ Do not add page markers'}
${skillsSection}
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
 * Calculate cost from API response usage
 */
function calculateCost(usage, model) {
  const pricing = MODEL_PRICING[model];
  if (!pricing || !usage) return 0;

  const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Parse page range string into array of page numbers
 * Example: "1-5, 7, 9-12" -> [1, 2, 3, 4, 5, 7, 9, 10, 11, 12]
 */
function parsePageRange(rangeStr, totalPages) {
  const pages = new Set();
  const parts = rangeStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

  for (const part of parts) {
    if (part.includes('-')) {
      // Range like "1-5"
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr);
      const end = parseInt(endStr);

      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid page range: "${part}". Pages must be numbers.`);
      }
      if (start < 1 || end > totalPages) {
        throw new Error(`Page range "${part}" is out of bounds. Document has ${totalPages} pages.`);
      }
      if (start > end) {
        throw new Error(`Invalid page range: "${part}". Start page must be less than or equal to end page.`);
      }

      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      // Single page like "7"
      const page = parseInt(part);
      if (isNaN(page)) {
        throw new Error(`Invalid page number: "${part}". Must be a number.`);
      }
      if (page < 1 || page > totalPages) {
        throw new Error(`Page ${page} is out of bounds. Document has ${totalPages} pages.`);
      }
      pages.add(page);
    }
  }

  if (pages.size === 0) {
    throw new Error('No valid pages specified in range.');
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Extract specific pages from a PDF and create a new PDF file
 * Returns path to the temporary PDF file with selected pages
 */
async function extractPdfPages(inputPath, pageNumbers) {
  const { PDFDocument } = require('pdf-lib');

  console.log(`[PAGE EXTRACTION] Extracting pages ${pageNumbers.join(', ')} from PDF`);

  // Load the PDF
  const inputPdfBytes = fs.readFileSync(inputPath);
  const inputPdf = await PDFDocument.load(inputPdfBytes);

  // Create new PDF with selected pages
  const outputPdf = await PDFDocument.create();

  // Copy selected pages (pdf-lib uses 0-based indexing, so subtract 1)
  for (const pageNum of pageNumbers) {
    const [copiedPage] = await outputPdf.copyPages(inputPdf, [pageNum - 1]);
    outputPdf.addPage(copiedPage);
  }

  // Save to temp file
  const outputBytes = await outputPdf.save();
  const tempPath = path.join(
    app.getPath('temp'),
    `pdf-converter-selected-${Date.now()}.pdf`
  );
  fs.writeFileSync(tempPath, outputBytes);

  console.log(`[PAGE EXTRACTION] Created temporary PDF at: ${tempPath}`);
  return tempPath;
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

  let totalCost = 0;
  let processedFilePath = filePath;
  let tempFileCleanup = null;

  try {
    // Step 1: Prepare file
    progressCallback({ status: 'preparing', progress: 10 });

    const mediaType = getMediaType(filePath);

    // Handle page selection for PDFs
    if (mediaType === 'application/pdf' && settings.pageSelection && settings.pageSelection.mode === 'range') {
      try {
        const rangeStr = settings.pageSelection.range?.trim();

        if (!rangeStr) {
          throw new Error('Page range is empty. Please enter a valid range (e.g., "1-5, 7, 9-12").');
        }

        // Get total page count using pdf-parse
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        const totalPages = pdfData.numpages;

        console.log(`[PAGE SELECTION] PDF has ${totalPages} total pages`);

        // Parse and validate range
        const selectedPages = parsePageRange(rangeStr, totalPages);

        console.log(`[PAGE SELECTION] User selected ${selectedPages.length} pages: ${selectedPages.join(', ')}`);

        // Extract selected pages to temporary PDF
        processedFilePath = await extractPdfPages(filePath, selectedPages);

        // Set cleanup function to delete temp file later
        tempFileCleanup = () => {
          try {
            if (fs.existsSync(processedFilePath)) {
              fs.unlinkSync(processedFilePath);
              console.log(`[CLEANUP] Deleted temporary PDF: ${processedFilePath}`);
            }
          } catch (e) {
            console.warn(`[CLEANUP] Could not delete temp file: ${e.message}`);
          }
        };

      } catch (error) {
        throw new Error(`Page selection failed: ${error.message}`);
      }
    }

    const fileBase64 = fileToBase64(processedFilePath);
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

    // Calculate cost from response
    if (response.usage) {
      const cost = calculateCost(response.usage, settings.model);
      totalCost += cost;
      console.log(`[COST] Request cost: $${cost.toFixed(4)} (Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens})`);
    }

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
      outputPath: outputPath,
      cost: totalCost
    };

  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  } finally {
    // Clean up temporary file if page selection was used
    if (tempFileCleanup) {
      tempFileCleanup();
    }
  }
}

module.exports = {
  convertFile
};
