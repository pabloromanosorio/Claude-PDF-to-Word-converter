const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildConversionPrompt, cleanCode, validateGeneratedCode, ensureFileWriting } = require('./converter');
const { analyzeDocument, selectStrategy } = require('./pdfAnalyzer');

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

    // Step 2: Analyze PDF
    jobManager.updateJob(jobId, {
      progress: 15,
      currentStep: 'Analyzing PDF complexity'
    });

    const analysis = await analyzeDocument(pdfBuffer);
    const strategy = selectStrategy(analysis);

    log(`PDF Analysis: ${analysis.pageCount} pages, ${analysis.sizeKB}KB (${analysis.kbPerPage}KB/page)`);
    log(`Complexity: ${analysis.complexity}, Estimated tokens: ${analysis.estimatedOutputTokens}`);
    log(`Strategy: ${strategy.reason}`);

    // Step 3: Convert PDF to base64
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

    // Use adaptive token limit from strategy
    const maxTokens = strategy.maxTokens;
    log(`Using adaptive token limit: ${maxTokens} tokens (based on ${strategy.type} strategy)`);

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
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

    // Check if response was truncated (used all allocated tokens)
    const outputTokens = response.usage.output_tokens;
    if (outputTokens >= maxTokens * 0.95) {
      log(`WARNING: Used ${outputTokens}/${maxTokens} tokens (95%+); response may be truncated`);
      // Save warning for validation to handle
      fs.writeFileSync(path.join(workDir, 'tokens_warning.txt'),
        `Used ${outputTokens}/${maxTokens} tokens (95%+). Response may be truncated.`);
    }

    const apiTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`API responded in ${apiTime}s`);

    // Step 5: Extract and clean code
    jobManager.updateJob(jobId, {
      progress: 60,
      currentStep: 'Cleaning generated code'
    });

    const rawCode = response.content[0].text;

    // Save raw response for debugging
    fs.writeFileSync(path.join(workDir, 'raw_response.txt'), rawCode);
    log(`Raw response: ${rawCode.length} chars`);

    // Clean the code
    let code = cleanCode(rawCode);
    fs.writeFileSync(path.join(workDir, 'cleaned.js'), code);
    log(`Cleaned code: ${code.length} chars`);

    // Step 6: Validate code
    jobManager.updateJob(jobId, {
      progress: 70,
      currentStep: 'Validating generated code'
    });

    // Check for token limit warning first
    const tokenWarningPath = path.join(workDir, 'tokens_warning.txt');
    if (fs.existsSync(tokenWarningPath)) {
      const warningMsg = fs.readFileSync(tokenWarningPath, 'utf8');
      log(`WARNING: ${warningMsg}`);

      // For now, try to proceed but warn the user
      // In the future, we could retry with a different model or chunk the PDF
      jobManager.updateJob(jobId, {
        warning: 'Response may be truncated due to token limit. Attempting to continue...'
      });
    }

    const validation = validateGeneratedCode(code);

    // Auto-fix if missing writeFileSync
    if (!validation.valid && validation.issues.includes('Missing writeFileSync')) {
      log('Missing writeFileSync detected, adding it automatically...');
      const outputPath = path.join(workDir, 'outputs', 'converted.docx');
      code = ensureFileWriting(code, outputPath);

      // Re-validate after adding file writing
      const revalidation = validateGeneratedCode(code);
      if (!revalidation.valid) {
        const errorMsg = `Code validation failed even after adding writeFileSync: ${revalidation.issues.join(', ')}`;
        log(`ERROR: ${errorMsg}`);
        fs.writeFileSync(path.join(workDir, 'validation_errors.txt'), revalidation.issues.join('\n'));
        throw new Error(errorMsg + `. Debug files saved in ${workDir}`);
      }
      log('File writing code added ✓');
    } else if (!validation.valid) {
      // Check if it's a truncation issue
      if (validation.issues.some(i => i.includes('writeFileSync') || i.includes('Document'))) {
        const truncationMsg = 'Generated code appears to be incomplete/truncated. This usually means the PDF is too large for the token limit.';
        log(`ERROR: ${truncationMsg}`);
        log(`Validation issues: ${validation.issues.join(', ')}`);

        // Save detailed debug info
        const debugInfo = [
          'TRUNCATION DETECTED',
          '',
          'The Claude API hit the token limit before completing the document.',
          'Suggestions:',
          '1. Try a smaller PDF',
          '2. Or process pages in batches',
          '',
          `Validation errors: ${validation.issues.join(', ')}`
        ].join('\n');
        fs.writeFileSync(path.join(workDir, 'truncation_error.txt'), debugInfo);

        throw new Error(`${truncationMsg} Debug files saved in ${workDir}`);
      }

      // Other validation errors - can't auto-fix
      const errorMsg = `Code validation failed: ${validation.issues.join(', ')}`;
      log(`ERROR: ${errorMsg}`);
      fs.writeFileSync(path.join(workDir, 'validation_errors.txt'), validation.issues.join('\n'));
      throw new Error(errorMsg + `. Debug files saved in ${workDir}`);
    }

    log('Code validated ✓');

    // Step 7: Save and execute code
    jobManager.updateJob(jobId, {
      progress: 80,
      currentStep: 'Generating DOCX file'
    });

    const scriptPath = path.join(workDir, 'convert.js');
    fs.writeFileSync(scriptPath, code);

    log('Executing generated code...');
    const execStart = Date.now();

    execSync(`node convert.js`, {
      cwd: workDir,
      timeout: 30000, // 30 seconds
      stdio: 'pipe'
    });

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
    // outputTokens already declared at line 106
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

    // Step 10: Schedule cleanup (30 minutes to allow slow downloads)
    setTimeout(() => {
      if (fs.existsSync(workDir)) {
        try {
          fs.rmSync(workDir, { recursive: true, force: true });
          log(`Cleaned up workspace: ${workDir}`);
        } catch (cleanupError) {
          console.error(`[${jobId}] Cleanup error:`, cleanupError.message);
        }
      }
      jobManager.deleteJob(jobId);
    }, 30 * 60 * 1000); // Extended to 30 minutes

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
