/**
 * Converter utilities for PDF to DOCX conversion
 */

/**
 * Build conversion prompt for Claude API
 * @param {Object} settings - User settings
 * @param {string} workDir - Working directory path
 * @returns {string} Complete conversion prompt
 */
function buildConversionPrompt(settings, workDir) {
  // Support both camelCase (frontend) and snake_case (legacy) keys
  const {
    font = 'Arial',
    fontSize = settings.font_size || 12,
    margins = {},
    preserveTableFormatting = settings.preserve_table_formatting !== undefined ?
      settings.preserve_table_formatting : true,
    addPageMarkers = settings.add_page_markers !== undefined ?
      settings.add_page_markers : false,
    replaceSignatures = settings.replace_signatures !== undefined ?
      settings.replace_signatures : false,
    overrideFormatting = settings.override_formatting !== undefined ?
      settings.override_formatting : false
  } = settings;

  let prompt = `You must output ONLY executable JavaScript code. No explanations, no markdown.

STEP 1: Read these files completely:
- /mnt/skills/public/docx/SKILL.md
- /mnt/skills/public/docx/docx-js.md

STEP 2: Analyze the PDF and generate code that follows this EXACT structure:

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

const doc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } }
    },
    children: [
      // Create paragraphs and tables here based on PDF content
      new Paragraph({
        children: [new TextRun("Content from PDF")]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.mkdirSync('${workDir}/outputs', { recursive: true });
  fs.writeFileSync('${workDir}/outputs/converted.docx', buffer);
  console.log('Conversion complete');
});

CRITICAL RULES:
- First line MUST be: const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
- Second line MUST be: const fs = require('fs');
- Last lines MUST be the Packer.toBuffer() call with writeFileSync
- NO markdown code blocks (no \`\`\`javascript or \`\`\`)
- NO text before or after the code
- Process ALL pages from the PDF
- DO NOT stop after page 1 or page 2
- Use BorderStyle.SINGLE for table borders
- Use ShadingType.CLEAR for table shading
- Never use \\n for line breaks - use separate Paragraph elements

Your output must be ready to save as a .js file and run with: node script.js

Output the JavaScript code now:`;

  if (overrideFormatting) {
    const marginTop = margins.top || 1440;
    const marginBottom = margins.bottom || 1440;
    const marginLeft = margins.left || 1440;
    const marginRight = margins.right || 1440;

    prompt += `\n   - Uses ${font} ${fontSize}pt font`;
    prompt += `\n   - Margins: Top ${marginTop}, Bottom ${marginBottom}, Left ${marginLeft}, Right ${marginRight} DXA`;
  } else {
    // Still include font if explicitly provided
    if (settings.font) {
      prompt += `\n   - Uses ${font} ${fontSize}pt font`;
    }
    prompt += `\n   - Preserves original formatting`;
  }

  if (preserveTableFormatting) {
    prompt += `\n   - Preserves table structures with proper borders`;
  }

  if (addPageMarkers) {
    prompt += `\n   - Adds page markers: [Page 2 of original document:], [Page 3 of original document:], etc.`;
    prompt += `\n   - Start markers from page 2 (not page 1)`;
  }

  if (replaceSignatures) {
    prompt += `\n   - Replaces signature images with: [Signature]`;
  }

  prompt += `\n   - Handles special characters correctly
   - Saves to ${workDir}/outputs/converted.docx

FORMATTING REQUIREMENTS:
- Never use \\n for line breaks - use separate Paragraph elements
- Tables: Set both columnWidths AND individual cell widths
- Borders: Apply to TableCell elements using BorderStyle.SINGLE
- Shading: Use ShadingType.CLEAR for headers (gray #D9D9D9)

Output ONLY executable JavaScript code, no explanations.`;

  return prompt;
}

/**
 * Clean generated code by removing markdown and extra text
 * @param {string} rawCode - Raw code from API
 * @returns {string} Cleaned code
 */
function cleanCode(rawCode) {
  let code = rawCode;

  // 1. Remove markdown code blocks
  code = code.replace(/```javascript\s*/g, '');
  code = code.replace(/```\s*/g, '');

  // 2. Trim whitespace
  code = code.trim();

  // 3. Find first "const" and cut before that
  const firstConst = code.indexOf('const {');
  if (firstConst > 0) {
    code = code.substring(firstConst);
  }

  // 4. Find last "});" and cut after that
  const lastBrace = code.lastIndexOf('});');
  if (lastBrace > 0 && lastBrace < code.length - 5) {
    code = code.substring(0, lastBrace + 3);
  }

  // 5. Ensure it has docx import
  if (!code.includes("require('docx')")) {
    const docxLine = "const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');\n";
    code = docxLine + code;
  }

  // 6. Ensure it has fs import
  if (!code.includes("require('fs')")) {
    const lines = code.split('\n');
    lines.splice(1, 0, "const fs = require('fs');");
    code = lines.join('\n');
  }

  return code;
}

/**
 * Validate generated code
 * @param {string} code - Generated JavaScript code
 * @returns {Object} Validation result
 */
function validateGeneratedCode(code) {
  const issues = [];

  // Must have docx import
  if (!code.includes("require('docx')")) {
    issues.push("Missing require('docx')");
  }

  // Must have required components
  const required = ['Document', 'Packer', 'Paragraph', 'TextRun'];
  required.forEach(comp => {
    if (!code.includes(comp)) {
      issues.push(`Missing ${comp}`);
    }
  });

  // Must have fs
  if (!code.includes("require('fs')")) {
    issues.push("Missing require('fs')");
  }

  // Must write file
  if (!code.includes('writeFileSync')) {
    issues.push("Missing writeFileSync");
  }

  // Should not have markdown
  if (code.includes('```')) {
    issues.push("Contains markdown blocks");
  }

  // Should start with const
  if (!code.trim().startsWith('const')) {
    issues.push("Doesn't start with const");
  }

  return {
    valid: issues.length === 0,
    issues: issues
  };
}

/**
 * Check if code is truncated (ends mid-statement)
 * @param {string} code - Generated JavaScript code
 * @returns {boolean} True if code appears truncated
 */
function isCodeTruncated(code) {
  code = code.trim();

  // Check if last line is incomplete (ends with , or : or { or [ or incomplete string)
  const lastLine = code.split('\\n').pop().trim();
  if (lastLine.match(/[,:\[{]$/) || lastLine.match(/^"[^"]*$/) || lastLine.match(/^'[^']*$/)) {
    return true;
  }

  // If it doesn't end with proper statement terminators, it's likely truncated
  const hasValidEnding = code.endsWith(');') || code.includes('});');
  if (!hasValidEnding) {
    return true;
  }

  return false;
}

/**
 * Validate if code structure is complete and safe to execute
 * @param {string} code - Generated JavaScript code
 * @returns {Object} Validation result with fix suggestion
 */
function validateStructureForExecution(code) {
  console.log('  Validating code structure before execution...');

  const issues = [];

  // Check for balanced braces by finding the Document structure
  const docMatch = code.match(/const doc = new Document\(\{[\s\S]*?\}\);/);
  if (!docMatch) {
    issues.push('Could not find complete Document structure');
  } else {
    // Extract just the Document part and verify it's complete
    const docSection = docMatch[0];
    const docOpenBraces = (docSection.match(/\{/g) || []).length;
    const docCloseBraces = (docSection.match(/\}/g) || []).length;

    if (docOpenBraces !== docCloseBraces) {
      issues.push(`Document structure unbalanced: ${docOpenBraces} opening { vs ${docCloseBraces} closing }`);
    }
  }

  // Check overall brace balance (safer than trying to auto-fix)
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  const openBrackets = (code.match(/\[/g) || []).length;
  const closeBrackets = (code.match(/\]/g) || []).length;
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;

  if (openBraces !== closeBraces) {
    issues.push(`Unbalanced curly braces: ${openBraces} open vs ${closeBraces} close`);
  }
  if (openBrackets !== closeBrackets) {
    issues.push(`Unbalanced square brackets: ${openBrackets} open vs ${closeBrackets} close`);
  }
  if (openParens !== closeParens) {
    issues.push(`Unbalanced parentheses: ${openParens} open vs ${closeParens} close`);
  }

  return {
    valid: issues.length === 0,
    issues: issues,
    canAttemptFix: issues.length <= 2 && issues.every(i => i.includes('Unbalanced')) // Only try to fix simple balance issues
  };
}

/**
 * Close incomplete code structure when truncated
 * @param {string} code - Generated JavaScript code (possibly truncated)
 * @returns {string} Code with properly closed Document structure
 */
function closeIncompleteStructure(code) {
  console.log('  Attempting to close incomplete document structure...');

  // For Document structure, we need to close in the proper order:
  // children array (]), section object (}), sections array (]), Document ({...});

  let closedCode = code.trim();

  // Remove any trailing incomplete characters (commas, colons, etc)
  closedCode = closedCode.replace(/[,:\s]+$/, '');

  // Check if we're inside a Paragraph/TextRun that needs closing
  // Look for unclosed new Paragraph( or new TextRun(
  const lastParagraph = closedCode.lastIndexOf('new Paragraph(');
  const lastParagraphClose = closedCode.lastIndexOf('})');
  if (lastParagraph > lastParagraphClose) {
    // Close the Paragraph properly
    closedCode += '\n      })';
  }

  // Now close the children array if needed
  if (!closedCode.includes('children: [') || closedCode.split('children: [').length > closedCode.split(']').length) {
    closedCode += '\n    ]';
  }

  // Close the section object
  const sectionsCount = (closedCode.match(/sections:\s*\[/g) || []).length;
  const sectionCloses = (closedCode.match(/}\s*\]/g) || []).length;
  if (sectionsCount > sectionCloses) {
    closedCode += '\n  }]';
  }

  // Close the Document
  if (!closedCode.includes('});') && closedCode.includes('new Document({')) {
    closedCode += '\n});';
  }

  return closedCode;
}

/**
 * Automatically add file writing code if missing
 * @param {string} code - Generated JavaScript code
 * @param {string} outputPath - Path where file should be saved
 * @returns {string} Code with file writing added
 */
function ensureFileWriting(code, outputPath) {
  // Check if code already has file writing
  if (code.includes('writeFileSync')) {
    return code; // Already has it
  }

  console.log('Adding missing file writing code...');

  // DEBUG: Show last 300 chars and first 300 chars
  console.log('  Code length:', code.length, 'characters');
  console.log('  First 300 chars:', code.substring(0, 300));
  console.log('  Last 300 chars:', code.substring(Math.max(0, code.length - 300)));

  // Check if code is truncated
  if (isCodeTruncated(code)) {
    console.log('  WARNING: Code appears to be truncated (hit token limit)');
    console.log('  Attempting to close the structure before adding file writing...');
    code = closeIncompleteStructure(code);
    console.log('  Code after closing:', code.substring(Math.max(0, code.length - 300)));
  }

  // Check if code has Packer.toBuffer but no writeFileSync
  if (code.includes('Packer.toBuffer')) {
    // Find where Packer.toBuffer ends - look for the closing of the then() block
    const packerPattern = /Packer\.toBuffer\(doc\)\.then\(buffer\s*=>\s*\{[\s\S]*?\}\);?/;
    const packerMatch = code.match(packerPattern);

    if (packerMatch) {
      console.log('  Found Packer.toBuffer, adding writeFileSync to existing block');
      // Insert writeFileSync into the existing then() block
      const toBufferSection = packerMatch[0];

      // Check if the block is empty or has content
      if (toBufferSection.includes('buffer => {\n}') || toBufferSection.includes('buffer => {}')) {
        // Empty block - replace entirely
        const withWriteFile = `Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});`;
        return code.replace(toBufferSection, withWriteFile);
      } else {
        // Has some content - insert before closing
        const withWriteFile = toBufferSection.replace(
          /}\);?$/,
          `  fs.writeFileSync('${outputPath}', buffer);\n  console.log('Conversion complete');\n});`
        );
        return code.replace(toBufferSection, withWriteFile);
      }
    } else {
      console.log('  Found Packer.toBuffer but could not parse the block structure');
    }
  }

  // No Packer.toBuffer at all - need to find where to add it
  // Look for Document pattern first
  const docPattern = /const doc = new Document\(\{[\s\S]*?\}\);/;
  const docMatch = code.match(docPattern);

  if (docMatch) {
    console.log('  Found Document structure, adding Packer.toBuffer after it');
    const docSection = docMatch[0];
    const fileWriting = `

Packer.toBuffer(doc).then(buffer => {
  fs.mkdirSync(path.dirname('${outputPath}'), { recursive: true });
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});`;
    return code.replace(docSection, docSection + fileWriting);
  }

  // Try finding just the closing of sections array or children array
  const sectionsClose = code.lastIndexOf(']');
  const childrenClose = code.lastIndexOf('}]');

  if (childrenClose > sectionsClose - 10 && childrenClose > 0) {
    console.log('  Found children array closing at position', childrenClose);
    const before = code.substring(0, childrenClose + 2);
    const after = code.substring(childrenClose + 2);
    const closeSection = code.includes('sections: [') ? '});' : '';

    const fileWriting = `${closeSection}\n\nPacker.toBuffer(doc).then(buffer => {\n  fs.mkdirSync(path.dirname('${outputPath}'), { recursive: true });\n  fs.writeFileSync('${outputPath}', buffer);\n  console.log('Conversion complete');\n});`;
    return before + fileWriting + after;
  }

  // Last resort - try to find the last });
  const lastBrace = code.lastIndexOf('});');
  if (lastBrace > 0) {
    console.log('  Using last closing brace at position', lastBrace);
    const before = code.substring(0, lastBrace + 3);
    const after = code.substring(lastBrace + 3);

    const fileWriting = `

Packer.toBuffer(doc).then(buffer => {
  fs.mkdirSync(path.dirname('${outputPath}'), { recursive: true });
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Conversion complete');
});`;

    return before + fileWriting + after;
  }

  // If we get here, the code is too malformed to fix
  console.log('  ERROR: Could not find any document structure in the code');
  console.log('  Code length:', code.length, 'characters');
  console.log('  First 500 chars:', code.substring(0, 500));
  throw new Error('Cannot find document structure in generated code. The code may be malformed or incomplete.');
}

/**
 * Build prompt for converting a PDF chunk
 * @param {Object} chunk - Chunk metadata (startPage, endPage, totalPages)
 * @param {string} outputPath - Path where DOCX should be saved
 * @param {boolean} isFirst - Is this the first chunk?
 * @param {boolean} isLast - Is this the last chunk?
 * @returns {string} Prompt for chunk conversion
 */
function buildChunkPrompt(chunk, outputPath, isFirst, isLast) {
  const continuityNote = isFirst ?
    'START: Include all imports and document structure.' :
    isLast ?
    'END: Include file writing (Packer.toBuffer and writeFileSync).' :
    'MIDDLE: Add content sections only.';

  let prompt = `Convert pages ${chunk.startPage}-${chunk.endPage} of ${chunk.totalPages}.

${continuityNote}

OPTIMIZATION: Use helper functions for repetitive elements.

`;

  if (isFirst) {
    prompt += `REQUIRED:
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

`;
  }

  if (isLast) {
    prompt += `REQUIRED ENDING:
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('${outputPath}', buffer);
  console.log('Done');
});

`;
  }

  prompt += `Output ONLY code, no markdown.`;

  return prompt;
}

module.exports = {
  buildConversionPrompt,
  buildChunkPrompt,
  cleanCode,
  validateGeneratedCode,
  ensureFileWriting
};
