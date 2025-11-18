/**
 * PDF Chunking Module
 * Splits large PDFs into chunks and merges generated code
 * Based on docs/ADAPTIVE_SYSTEM.md specification
 */

const { PDFDocument } = require('pdf-lib');

/**
 * Split PDF into chunks for processing
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {number} pagesPerChunk - Number of pages per chunk
 * @returns {Promise<Array<Object>>} Array of chunk objects
 */
async function splitPdfIntoChunks(pdfBuffer, pagesPerChunk) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  const chunks = [];

  for (let i = 0; i < totalPages; i += pagesPerChunk) {
    const newPdf = await PDFDocument.create();
    const endPage = Math.min(i + pagesPerChunk, totalPages);

    const copiedPages = await newPdf.copyPages(
      pdfDoc,
      Array.from({ length: endPage - i }, (_, j) => i + j)
    );

    copiedPages.forEach(page => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    chunks.push({
      index: Math.floor(i / pagesPerChunk),
      startPage: i + 1,
      endPage: endPage,
      totalPages: totalPages,
      buffer: Buffer.from(pdfBytes),
      base64: Buffer.from(pdfBytes).toString('base64')
    });
  }

  return chunks;
}

/**
 * Merge code from multiple chunks into single JavaScript file
 * @param {Array<string>} chunkCodes - Array of generated code strings
 * @returns {string} Merged JavaScript code
 */
function mergeChunkCodes(chunkCodes) {
  if (chunkCodes.length === 0) {
    throw new Error('No chunk codes to merge');
  }

  if (chunkCodes.length === 1) {
    return chunkCodes[0];
  }

  // Start with first chunk (has imports and doc structure)
  let merged = chunkCodes[0];

  // Extract content from middle chunks
  for (let i = 1; i < chunkCodes.length - 1; i++) {
    const contentMatch = chunkCodes[i].match(/children:\s*\[([\s\S]*?)\]\s*}\s*\]\s*}\s*\)/);
    if (contentMatch) {
      const newContent = contentMatch[1].trim();
      // Find where to insert (before closing of children array)
      const insertPoint = merged.lastIndexOf(']') - 1; // Before last ]
      merged = merged.substring(0, insertPoint) +
               ',\n' + newContent +
               merged.substring(insertPoint);
    }
  }

  // Add last chunk's content (if it has any beyond file writing)
  if (chunkCodes.length > 1) {
    const lastChunk = chunkCodes[chunkCodes.length - 1];
    const contentMatch = lastChunk.match(/children:\s*\[([\s\S]*?)\]\s*}\s*\]\s*}\s*\)/);
    if (contentMatch) {
      const newContent = contentMatch[1].trim();
      const insertPoint = merged.lastIndexOf(']') - 1;
      merged = merged.substring(0, insertPoint) +
               ',\n' + newContent +
               merged.substring(insertPoint);
    }
  }

  // Ensure file writing is present
  if (!merged.includes('Packer.toBuffer')) {
    const lastChunk = chunkCodes[chunkCodes.length - 1];
    const packMatch = lastChunk.match(/(Packer\.toBuffer[\s\S]*?}\);)/);
    if (packMatch) {
      merged += '\n\n' + packMatch[1];
    }
  }

  return merged;
}

module.exports = {
  splitPdfIntoChunks,
  mergeChunkCodes
};
