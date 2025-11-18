#!/usr/bin/env node
// diagnostic.js - Run this to see what's happening with your API calls

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

function header(text) {
  console.log('\n' + '═'.repeat(60));
  log(colors.cyan, text);
  console.log('═'.repeat(60));
}

async function runDiagnostic() {
  try {
    header('PDF-TO-DOCX CONVERSION DIAGNOSTIC');
    
    // Check 1: API Key
    header('1. Checking API Key');
    if (!process.env.ANTHROPIC_API_KEY) {
      log(colors.red, '✗ API key not found');
      console.log('Set it with: export ANTHROPIC_API_KEY="your-key"');
      process.exit(1);
    }
    log(colors.green, '✓ API key is set');
    
    // Check 2: Dependencies
    header('2. Checking Dependencies');
    
    try {
      require('@anthropic-ai/sdk');
      log(colors.green, '✓ @anthropic-ai/sdk installed');
    } catch (e) {
      log(colors.red, '✗ @anthropic-ai/sdk not installed');
      console.log('Install with: npm install @anthropic-ai/sdk');
      process.exit(1);
    }
    
    try {
      require('docx');
      log(colors.green, '✓ docx installed');
    } catch (e) {
      log(colors.red, '✗ docx not installed');
      console.log('Install with: npm install docx');
      process.exit(1);
    }
    
    // Check 3: Test PDF
    header('3. Checking Test PDF');
    
    const args = process.argv.slice(2);
    if (args.length === 0) {
      log(colors.yellow, '! No PDF file specified');
      console.log('Usage: node diagnostic.js path/to/test.pdf');
      console.log('\nRunning test without PDF...');
    }
    
    let pdfPath = args[0];
    let pdfBuffer = null;
    
    if (pdfPath && fs.existsSync(pdfPath)) {
      log(colors.green, '✓ PDF file found:', pdfPath);
      pdfBuffer = fs.readFileSync(pdfPath);
      log(colors.blue, '  Size:', (pdfBuffer.length / 1024).toFixed(2), 'KB');
    }
    
    // Check 4: API Connection
    header('4. Testing API Connection');
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    log(colors.blue, 'Sending test request to Claude API...');
    
    const testPrompt = `You are a code generator. Output ONLY this exact JavaScript code with no markdown or explanations:

const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');
const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun("Test")] })
    ]
  }]
});
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('test.docx', buffer);
});`;

    const content = [];
    
    if (pdfBuffer) {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdfBuffer.toString('base64')
        }
      });
    }
    
    content.push({
      type: "text",
      text: testPrompt
    });
    
    const startTime = Date.now();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.3,
      messages: [{
        role: "user",
        content: content
      }]
    });
    const duration = Date.now() - startTime;
    
    log(colors.green, '✓ API request successful');
    log(colors.blue, '  Response time:', duration, 'ms');
    log(colors.blue, '  Input tokens:', message.usage.input_tokens);
    log(colors.blue, '  Output tokens:', message.usage.output_tokens);
    
    // Check 5: Response Analysis
    header('5. Analyzing Response');
    
    const response = message.content[0].text;
    log(colors.blue, 'Response length:', response.length, 'characters');
    
    // Save response
    fs.writeFileSync('diagnostic_response.txt', response);
    log(colors.green, '✓ Saved response to diagnostic_response.txt');
    
    console.log('\n' + '─'.repeat(60));
    console.log('RESPONSE PREVIEW:');
    console.log('─'.repeat(60));
    console.log(response.substring(0, 500));
    if (response.length > 500) {
      console.log('... (truncated, see diagnostic_response.txt for full response)');
    }
    console.log('─'.repeat(60));
    
    // Check 6: Code Validation
    header('6. Validating Generated Code');
    
    const checks = {
      'Starts with const': response.trim().startsWith('const'),
      'Has docx import': response.includes("require('docx')"),
      'Has fs import': response.includes("require('fs')"),
      'Has Document': response.includes('Document'),
      'Has Packer': response.includes('Packer'),
      'Has Paragraph': response.includes('Paragraph'),
      'Has TextRun': response.includes('TextRun'),
      'Has writeFileSync': response.includes('writeFileSync'),
      'No markdown blocks': !response.includes('```'),
      'No explanatory text': !response.match(/^(Here|I'll|This|Let me)/i)
    };
    
    let allPassed = true;
    for (const [check, passed] of Object.entries(checks)) {
      if (passed) {
        log(colors.green, '✓', check);
      } else {
        log(colors.red, '✗', check);
        allPassed = false;
      }
    }
    
    // Check 7: Code Cleaning
    if (!allPassed) {
      header('7. Testing Code Cleaning');
      
      let cleaned = response;
      
      // Remove markdown
      cleaned = cleaned.replace(/```javascript\n?/g, '');
      cleaned = cleaned.replace(/```\n?/g, '');
      cleaned = cleaned.trim();
      
      // Find code boundaries
      const codeStart = cleaned.indexOf('const {');
      if (codeStart > 0) {
        cleaned = cleaned.substring(codeStart);
        log(colors.yellow, '→ Removed', codeStart, 'chars before code');
      }
      
      const codeEnd = cleaned.lastIndexOf('});');
      if (codeEnd > 0 && codeEnd < cleaned.length - 5) {
        const removed = cleaned.length - codeEnd - 3;
        cleaned = cleaned.substring(0, codeEnd + 3);
        log(colors.yellow, '→ Removed', removed, 'chars after code');
      }
      
      // Re-check after cleaning
      const cleanChecks = {
        'Has docx import': cleaned.includes("require('docx')"),
        'Has fs import': cleaned.includes("require('fs')"),
        'No markdown': !cleaned.includes('```')
      };
      
      let cleanPassed = true;
      for (const [check, passed] of Object.entries(cleanChecks)) {
        if (passed) {
          log(colors.green, '✓ After cleaning:', check);
        } else {
          log(colors.red, '✗ After cleaning:', check);
          cleanPassed = false;
        }
      }
      
      if (cleanPassed) {
        log(colors.green, '✓ Code can be fixed with cleaning');
      } else {
        log(colors.red, '✗ Code has issues even after cleaning');
      }
      
      fs.writeFileSync('diagnostic_cleaned.js', cleaned);
      log(colors.green, '✓ Saved cleaned code to diagnostic_cleaned.js');
    }
    
    // Summary
    header('DIAGNOSTIC SUMMARY');
    
    if (allPassed) {
      log(colors.green, '✓ ALL CHECKS PASSED');
      console.log('\nYour API is returning valid code!');
      console.log('The code is ready to execute.');
    } else {
      log(colors.yellow, '! SOME CHECKS FAILED');
      console.log('\nThe API is returning code with issues.');
      console.log('But they can likely be fixed with code cleaning.');
      console.log('\nCheck the troubleshooting guides:');
      console.log('- QUICK_FIX.md for working code');
      console.log('- TROUBLESHOOTING.md for solutions');
      console.log('- VISUAL_DEBUG_GUIDE.md for examples');
    }
    
    console.log('\nFiles created:');
    console.log('- diagnostic_response.txt (raw API response)');
    if (!allPassed) {
      console.log('- diagnostic_cleaned.js (cleaned code)');
    }
    
    console.log('\n' + '═'.repeat(60));
    
  } catch (error) {
    console.error('\n' + '═'.repeat(60));
    log(colors.red, '✗ ERROR:', error.message);
    console.error('═'.repeat(60));
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run diagnostic
console.log('Starting diagnostic...\n');
runDiagnostic().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
