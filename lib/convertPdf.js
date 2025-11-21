const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { extractPages } = require('./pdfPageExtractor');

const MODEL_PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00, cache: 0.10 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00, cache: 0.30 }
};

/**
 * Convert PDF or image to DOCX using Claude API with docx skill
 * (Matching Python backend approach - no code generation!)
 * @param {Buffer} pdfBuffer - PDF or image file buffer
 * @param {string} jobId - Job ID
 * @param {Object} settings - Conversion settings (includes mimeType for detecting file type)
 * @param {JobManager} jobManager - Job manager instance
 */
async function convertPdf(pdfBuffer, jobId, settings, jobManager) {
  const workDir = path.join(process.cwd(), 'output', `conversion-${jobId}`);
  const enableLogging = settings.enableLogging || false;

  const log = (message) => {
    if (enableLogging) {
      console.log(`[${jobId}] ${message}`);
    }
  };

  try {
    // Step 1: Setup workspace
    jobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      currentStep: 'Setting up workspace'
    });

    fs.mkdirSync(workDir, { recursive: true });
    log('Workspace created');

    // Detect if this is an image or PDF
    const mimeType = settings.mimeType || 'application/pdf';
    const isImage = mimeType.startsWith('image/');
    const fileType = isImage ? 'image' : 'document';

    // Step 2: Extract specific pages if page range is specified (PDFs only)
    let processedPdfBuffer = pdfBuffer;
    if (!isImage && settings.pageRange && settings.pageRange.trim() !== '') {
      jobManager.updateJob(jobId, {
        progress: 15,
        currentStep: 'Extracting pages'
      });

      try {
        processedPdfBuffer = await extractPages(pdfBuffer, settings.pageRange);
        log(`Extracted pages: ${settings.pageRange}`);
      } catch (error) {
        throw new Error(`Page extraction failed: ${error.message}`);
      }
    }

    // Step 3: Encode file as base64
    jobManager.updateJob(jobId, {
      progress: 20,
      currentStep: isImage ? 'Encoding image' : 'Encoding PDF'
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured. Please click the settings icon (⚙️) in the top right and enter your Anthropic API key from https://console.anthropic.com/settings/keys');
    }

    if (apiKey.length < 100 || apiKey.includes('your-key')) {
      throw new Error('Invalid API key. Please update your API key in settings with a real key from https://console.anthropic.com/settings/keys');
    }

    const anthropic = new Anthropic({ apiKey });

    // Convert processed buffer to base64
    const fileBase64 = processedPdfBuffer.toString('base64');
    log(`${isImage ? 'Image' : 'PDF'} encoded (${fileBase64.length} chars)`);

    // Step 4: Build prompt (simplified - matching Python backend)
    jobManager.updateJob(jobId, {
      progress: 30,
      currentStep: 'Preparing conversion'
    });

    const prompt = isImage ? buildImagePrompt(settings) : buildPrompt(settings);

    // Step 5: Call Claude API with docx skill
    jobManager.updateJob(jobId, {
      progress: 40,
      currentStep: 'Processing with Claude + docx skill'
    });

    const model = settings.model || 'claude-haiku-4-5-20251001';
    log(`Calling Claude API with ${model} and docx skill (streaming)`);
    const startTime = Date.now();

    const stream = anthropic.beta.messages.stream({
      model,
      max_tokens: 32000,
      betas: [
        'code-execution-2025-08-25',
        'skills-2025-10-02'
      ],
      container: {
        skills: [{
          type: 'anthropic',
          skill_id: 'docx',
          version: 'latest'
        }]
      },
      messages: [{
        role: 'user',
        content: [
          {
            type: fileType,  // 'image' or 'document'
            source: {
              type: 'base64',
              media_type: mimeType,  // e.g., 'image/jpeg' or 'application/pdf'
              data: fileBase64
            },
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }],
      tools: [{
        type: 'code_execution_20250825',
        name: 'code_execution'
      }]
    });

    // Handle streaming events
    stream.on('text', (textDelta) => {
      log(`Claude: ${textDelta}`);
    });

    stream.on('content_block_delta', (delta) => {
      if (delta.type === 'input_json_delta') {
        log('Tool input delta received');
      }
    });

    // Wait for completion
    const response = await stream.finalMessage();

    const apiTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`API responded in ${apiTime}s`);

    // Step 6: Extract generated file
    jobManager.updateJob(jobId, {
      progress: 70,
      currentStep: 'Extracting result'
    });

    const generatedFileId = extractFileId(response);

    if (!generatedFileId) {
      console.error(`[${jobId}] No file generated. Response:`, JSON.stringify(response.content, null, 2));
      throw new Error('No DOCX file generated by docx skill');
    }

    log(`File generated: ${generatedFileId}`);

    // Step 7: Download the generated DOCX
    jobManager.updateJob(jobId, {
      progress: 85,
      currentStep: 'Downloading result'
    });

    const fileMetadata = await anthropic.beta.files.retrieveMetadata(
      generatedFileId,
      { betas: ['files-api-2025-04-14'] }
    );

    const fileContent = await anthropic.beta.files.download(
      generatedFileId,
      { betas: ['files-api-2025-04-14'] }
    );

    const outputPath = path.join(workDir, fileMetadata.filename || 'converted.docx');

    // Convert Response to Buffer
    const arrayBuffer = await fileContent.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(outputPath, buffer);

    log(`Downloaded: ${fileMetadata.filename}`);

    // Step 8: Calculate cost
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cachedTokens = response.usage.cache_read_input_tokens || 0;
    const cacheCreationTokens = response.usage.cache_creation_input_tokens || 0;

    const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-haiku-4-5-20251001'];
    const cost = (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output +
      (cachedTokens / 1_000_000) * pricing.cache +
      (cacheCreationTokens / 1_000_000) * pricing.input; // Cache creation charged at input rate

    // Always log token usage (not just when enableLogging is on)
    console.log(`[${jobId}] Tokens: ${inputTokens} input, ${outputTokens} output`);
    if (cacheCreationTokens > 0) {
      console.log(`[${jobId}] Cache: ${cacheCreationTokens} created (first time - future conversions will be 90% cheaper!)`);
    }
    if (cachedTokens > 0) {
      const savedCost = (cachedTokens / 1_000_000) * (pricing.input - pricing.cache);
      console.log(`[${jobId}] Cache: ${cachedTokens} read (saved $${savedCost.toFixed(4)}!)`);
    }
    console.log(`[${jobId}] Cost: $${cost.toFixed(4)}`);

    // Step 9: Complete
    jobManager.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'Complete',
      outputPath,
      inputTokens,
      outputTokens,
      actualCost: cost,
      completedAt: Date.now()
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✓ Conversion complete (${totalTime}s total)`);

    // Cleanup handled by JobManager after 24h
    // setTimeout(() => {
    //   if (fs.existsSync(workDir)) {
    //     fs.rmSync(workDir, { recursive: true, force: true });
    //   }
    //   jobManager.deleteJob(jobId);
    // }, 5 * 60 * 1000);

  } catch (error) {
    console.error(`[${jobId}] Conversion failed:`, error.message);
    if (error.response) {
      console.error(`[${jobId}] API error details:`, error.response);
    }

    jobManager.updateJob(jobId, {
      status: 'failed',
      error: error.message
    });

    // Cleanup on error
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }

    throw error;
  }
}

/**
 * Build conversion prompt (natural language style matching official Anthropic examples)
 */
function buildPrompt(settings) {
  const {
    font = 'Arial',
    fontSize = 12,
    margins = {},
    preserveTableFormatting = true,
    addPageMarkers = false,
    replaceSignatures = false,
    overrideFormatting = false,
    customInstructions = ''
  } = settings;

  // Natural language task description with explicit skill mention
  let prompt = 'Create a Word document from this PDF using the docx skill. Preserve all formatting, tables, and content from every page.';

  if (overrideFormatting) {
    const marginTop = (margins.top || 1440) / 1440;
    prompt += ` Use ${font} ${fontSize}pt font and ${marginTop}" margins.`;
  }

  if (addPageMarkers) {
    prompt += ' Add [Page N] markers after page breaks.';
  }

  if (replaceSignatures) {
    prompt += ' Replace signature images with [Signature].';
  }

  if (customInstructions) {
    prompt += ' ' + customInstructions;
  }

  return prompt;
}

/**
 * Build conversion prompt for images (natural language style matching official Anthropic examples)
 */
function buildImagePrompt(settings) {
  const {
    font = 'Arial',
    fontSize = 12,
    margins = {},
    overrideFormatting = false,
    customInstructions = ''
  } = settings;

  // Natural language task description with explicit skill mention
  let prompt = 'Create a Word document from this image using the docx skill. Extract all text and preserve the formatting.';

  if (overrideFormatting) {
    const marginTop = (margins.top || 1440) / 1440;
    prompt += ` Use ${font} ${fontSize}pt font and ${marginTop}" margins.`;
  }

  if (customInstructions) {
    prompt += ' ' + customInstructions;
  }

  return prompt;
}

/**
 * Extract file ID from Claude response
 * Uses multiple strategies (matching Python backend)
 */
function extractFileId(response) {
  // Strategy 1: Check bash_code_execution_tool_result
  for (const item of response.content) {
    if (item.type === 'bash_code_execution_tool_result') {
      const content = item.content;
      if (content && content.type === 'bash_code_execution_result') {
        for (const file of content.content || []) {
          if (file.file_id) {
            return file.file_id;
          }
        }
      }
    }
  }

  // Strategy 2: Check text content for file IDs
  for (const item of response.content) {
    if (item.type === 'text' && item.text) {
      const match = item.text.match(/file-[a-zA-Z0-9_-]{20,}/);
      if (match) {
        return match[0];
      }
    }
  }

  // Strategy 3: Deep inspection
  const jsonStr = JSON.stringify(response.content);
  const match = jsonStr.match(/file-[a-zA-Z0-9_-]{20,}/);
  if (match) {
    return match[0];
  }

  return null;
}

module.exports = { convertPdf };
