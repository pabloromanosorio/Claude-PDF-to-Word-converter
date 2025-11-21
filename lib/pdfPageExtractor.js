const { PDFDocument } = require('pdf-lib');

/**
 * Parse page range string into array of page numbers
 * @param {string} rangeStr - Page range string like "1-5, 7, 9-12"
 * @returns {number[]} - Array of page numbers (1-indexed)
 */
function parsePageRange(rangeStr) {
  if (!rangeStr || rangeStr.trim() === '') {
    return null; // null means all pages
  }

  const pages = new Set();
  const parts = rangeStr.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      // Range like "1-5"
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        throw new Error(`Invalid page range: ${part}`);
      }
      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      // Single page like "7"
      const pageNum = parseInt(part, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        throw new Error(`Invalid page number: ${part}`);
      }
      pages.add(pageNum);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Extract specific pages from PDF buffer
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {string} pageRange - Page range string like "1-5, 7, 9-12"
 * @returns {Promise<Buffer>} - New PDF buffer with only selected pages
 */
async function extractPages(pdfBuffer, pageRange) {
  const pageNumbers = parsePageRange(pageRange);

  // If no page range specified, return original buffer
  if (pageNumbers === null) {
    return pdfBuffer;
  }

  // Load the original PDF
  const originalPdf = await PDFDocument.load(pdfBuffer);
  const totalPages = originalPdf.getPageCount();

  // Validate page numbers don't exceed total pages
  const maxPage = Math.max(...pageNumbers);
  if (maxPage > totalPages) {
    throw new Error(`Page ${maxPage} exceeds total pages (${totalPages})`);
  }

  // Create a new PDF with only the selected pages
  const newPdf = await PDFDocument.create();

  for (const pageNum of pageNumbers) {
    const [copiedPage] = await newPdf.copyPages(originalPdf, [pageNum - 1]); // pdf-lib uses 0-indexed
    newPdf.addPage(copiedPage);
  }

  // Return the new PDF as a buffer
  const pdfBytes = await newPdf.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  parsePageRange,
  extractPages
};
