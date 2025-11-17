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
  const {
    font = 'Arial',
    fontSize = 12,
    margins = {},
    preserveTableFormatting = true,
    addPageMarkers = false,
    replaceSignatures = false,
    overrideFormatting = false
  } = settings;

  let prompt = `Convert this PDF to DOCX format.

CRITICAL INSTRUCTIONS:
1. Read /mnt/skills/public/docx/SKILL.md completely (no range limits)
2. Read /mnt/skills/public/docx/docx-js.md completely (no range limits)
3. Analyze PDF structure (headers, tables, formatting)
4. Generate JavaScript using docx library that:
   - Preserves ALL content from ALL PAGES
   - DO NOT stop after page 1 or page 2
   - Process EVERY SINGLE PAGE in the document
   - Recreates tables with borders
   - Maintains formatting (bold, italic, alignment)`;

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
 * Validate and clean generated code
 * @param {string} code - Generated JavaScript code
 * @returns {string} Cleaned code
 * @throws {Error} If code is invalid
 */
function validateGeneratedCode(code) {
  // Remove markdown code blocks
  let cleaned = code
    .replace(/```javascript\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Validate required imports
  if (!cleaned.includes('Document') || !cleaned.includes('Packer')) {
    throw new Error('Invalid code generated - missing required docx imports');
  }

  return cleaned;
}

module.exports = {
  buildConversionPrompt,
  validateGeneratedCode
};
