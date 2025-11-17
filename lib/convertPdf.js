const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildConversionPrompt, validateGeneratedCode } = require('./converter');

const MODEL_PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 }
};

/**
 * Convert PDF to DOCX using Claude API
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} jobId - Job ID
 * @param {Object} settings - Conversion settings
 * @param {JobManager} jobManager - Job manager instance
 */
async function convertPdf(pdfBuffer, jobId, settings, jobManager) {
  const workDir = `/tmp/conversion-${jobId}`;
  const enableLogging = settings.enableLogging || false;

  const log = (message) => {
    if (enableLogging) {
      console.log(`[${jobId}] ${message}`);
    }
  };

  try {
    // Step 1: Setup directories
    jobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      currentStep: 'Setting up workspace'
    });

    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(path.join(workDir, 'outputs'), { recursive: true });

    log('Workspace created');

    // Step 2: Convert PDF to base64
    jobManager.updateJob(jobId, {
      progress: 20,
      currentStep: 'Encoding PDF'
    });

    const base64Pdf = pdfBuffer.toString('base64');
    log(`PDF encoded (${base64Pdf.length} chars)`);

    // Step 3: Build prompt
    jobManager.updateJob(jobId, {
      progress: 30,
      currentStep: 'Preparing API request'
    });

    const prompt = buildConversionPrompt(settings, workDir);

    // Step 4: Call Claude API
    jobManager.updateJob(jobId, {
      progress: 40,
      currentStep: 'Calling Claude API...'
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({ apiKey });
    const model = settings.model || 'claude-haiku-4-5-20251001';

    log(`Calling Claude API with ${model}`);
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    const apiTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`API responded in ${apiTime}s`);

    // Step 5: Extract and validate code
    jobManager.updateJob(jobId, {
      progress: 70,
      currentStep: 'Validating generated code'
    });

    let code = response.content[0].text;

    // Log the raw response for debugging
    if (enableLogging) {
      console.log(`[${jobId}] Raw Claude response (first 500 chars):`, code.substring(0, 500));
    }

    try {
      code = validateGeneratedCode(code);
    } catch (validationError) {
      console.error(`[${jobId}] Validation failed:`, validationError.message);
      console.error(`[${jobId}] Full response:`, code);
      throw validationError;
    }

    // Update output path in code
    code = code.replace(
      /\/mnt\/user-data\/outputs\//g,
      `${workDir}/outputs/`
    );

    log('Code validated');

    // Step 6: Save and execute code
    jobManager.updateJob(jobId, {
      progress: 80,
      currentStep: 'Generating DOCX file'
    });

    const scriptPath = path.join(workDir, 'convert.js');
    fs.writeFileSync(scriptPath, code);

    if (enableLogging) {
      console.log(`[${jobId}] Generated code saved to:`, scriptPath);
      console.log(`[${jobId}] Code length:`, code.length, 'chars');
    }

    log('Executing generated code...');
    const execStart = Date.now();

    try {
      const output = execSync(`node convert.js`, {
        cwd: workDir,
        timeout: 30000, // 30 seconds
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      if (enableLogging && output) {
        console.log(`[${jobId}] Execution output:`, output);
      }
    } catch (execError) {
      console.error(`[${jobId}] Code execution failed:`, execError.message);
      if (execError.stderr) {
        console.error(`[${jobId}] stderr:`, execError.stderr.toString());
      }
      if (execError.stdout) {
        console.error(`[${jobId}] stdout:`, execError.stdout.toString());
      }
      throw new Error(`Code execution failed: ${execError.message}`);
    }

    const execTime = ((Date.now() - execStart) / 1000).toFixed(1);
    log(`Code executed in ${execTime}s`);

    // Step 7: Verify output
    jobManager.updateJob(jobId, {
      progress: 90,
      currentStep: 'Verifying output'
    });

    const outputFiles = fs.readdirSync(path.join(workDir, 'outputs'));
    if (outputFiles.length === 0) {
      throw new Error('No output file created');
    }

    const outputPath = path.join(workDir, 'outputs', outputFiles[0]);
    log(`Output created: ${outputFiles[0]}`);

    // Step 8: Calculate cost
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-haiku-4-5-20251001'];
    const cost = (inputTokens / 1_000_000) * pricing.input +
                 (outputTokens / 1_000_000) * pricing.output;

    log(`Tokens: ${inputTokens} input, ${outputTokens} output`);
    log(`Cost: $${cost.toFixed(4)}`);

    // Step 9: Update job as completed
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

    // Step 10: Schedule cleanup (5 minutes)
    setTimeout(() => {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
      jobManager.deleteJob(jobId);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error(`[${jobId}] Conversion failed:`, error.message);

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

module.exports = { convertPdf };
