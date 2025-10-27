const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const apiKeyManager = require('./api-key-manager');

/**
 * Convert file using Skills API
 */
async function convertWithSkills(filePath, fileName, settings, progressCallback) {
  const apiKey = apiKeyManager.getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured');
  }

  const skillId = apiKeyManager.getSkillId();
  if (!skillId) {
    throw new Error('Skill ID not configured. Upload the skill first.');
  }

  const client = new Anthropic({ apiKey });
  const outputDir = path.dirname(filePath);

  try {
    // Step 1: Prepare file
    progressCallback({ status: 'preparing', progress: 10 });

    const mediaType = getMediaType(filePath);
    const fileBase64 = fileToBase64(filePath);

    // Step 2: Build prompt with user settings
    const prompt = buildPrompt(settings, outputDir, fileName);

    // Step 3: Send to Claude with Skills API
    progressCallback({ status: 'analyzing', progress: 30 });

    const response = await client.messages.create({
      model: settings.model || 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      betas: [
        'code-execution-2025-08-25',
        'skills-2025-10-02'
      ],
      tools: [{
        type: 'code_execution_2025_08_25',
        name: 'code_execution'
      }],
      container: {
        skills: [{
          type: 'custom',
          skill_id: skillId,
          version: 'latest'
        }]
      },
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
            text: prompt
          }
        ]
      }]
    });

    progressCallback({ status: 'generating', progress: 70 });

    // Step 4: Extract code from response and execute
    const responseText = response.content.find(c => c.type === 'text')?.text || '';
    const code = extractCode(responseText);

    if (!code) {
      throw new Error('No code generated. Response: ' + responseText.substring(0, 200));
    }

    // Step 5: Execute code
    progressCallback({ status: 'creating document', progress: 85 });

    const { spawn } = require('child_process');
    const tempDir = path.join(require('electron').app.getPath('temp'), 'pdf-converter');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const codePath = path.join(tempDir, `${fileName}_converter.js`);
    fs.writeFileSync(codePath, code);

    await executeCode(codePath, outputDir, fileName);

    progressCallback({ status: 'complete', progress: 100 });

    // Calculate cost
    const cost = calculateCost(response.usage, settings.model);

    return {
      success: true,
      fileName: `${fileName}.docx`,
      outputPath: path.join(outputDir, `${fileName}.docx`),
      cost: cost
    };

  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

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

function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

function buildPrompt(settings, outputPath, fileName) {
  return `
Convert this document image to a professional Word document.

**Output Settings:**
- Save to: ${outputPath}/${fileName}.docx
- Font: ${settings.font || 'Arial'}
- Font Size: ${settings.fontSize || 12}pt
- Margins: Top ${(settings.margins?.top || 1440) / 1440}", Right ${(settings.margins?.right || 1440) / 1440}", Bottom ${(settings.margins?.bottom || 1440) / 1440}", Left ${(settings.margins?.left || 1440) / 1440}"

**Special Requests:**
${settings.replaceSignatures ? '- Replace signatures with [Signature]' : '- Keep signature images'}
${settings.addPageMarkers ? '- Add [Page X of the original] markers (except page 1)' : '- Do not add page markers'}

**CRITICAL: Return ONLY executable JavaScript code.**

1. Generate complete, runnable Node.js code using docx-js
2. Include ALL necessary require() statements
3. Wrap code in \`\`\`javascript code blocks
4. Print "SUCCESS: ${fileName}.docx" when complete
5. Exit with process.exit(0) on success

**Now generate the code for this document.**
`;
}

function extractCode(responseText) {
  const codeBlockRegex = /```javascript\n([\s\S]*?)\n```/g;
  const matches = [...responseText.matchAll(codeBlockRegex)];

  if (matches.length === 0) {
    const genericCodeRegex = /```\n([\s\S]*?)\n```/g;
    const genericMatches = [...responseText.matchAll(genericCodeRegex)];

    if (genericMatches.length > 0) {
      return genericMatches.map(m => m[1]).join('\n\n');
    }

    return null;
  }

  return matches.map(m => m[1]).join('\n\n');
}

async function executeCode(codePath, outputDir, fileName) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const projectNodeModules = path.join(__dirname, '..', 'node_modules');

    const env = {
      ...process.env,
      NODE_PATH: projectNodeModules
    };

    const nodeProcess = spawn('node', [codePath], { env });

    let stdout = '';
    let stderr = '';

    nodeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    nodeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    nodeProcess.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(`Code execution failed (exit code ${exitCode}):\n${stderr}\n${stdout}`));
      }
    });
  });
}

function calculateCost(usage, model) {
  const pricing = {
    'claude-haiku-4-5': { input: 1.00, output: 5.00 },
    'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 }
  };

  const modelPricing = pricing[model] || pricing['claude-sonnet-4-5-20250929'];

  if (!usage) return 0;

  const inputCost = (usage.input_tokens / 1_000_000) * modelPricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * modelPricing.output;

  return inputCost + outputCost;
}

module.exports = {
  convertWithSkills
};
