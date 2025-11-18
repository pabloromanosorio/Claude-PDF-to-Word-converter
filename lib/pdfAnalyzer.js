/**
 * PDF Analysis Module
 * Analyzes PDF complexity and recommends optimal conversion strategy
 * Based on docs/ADAPTIVE_SYSTEM.md specification
 */

const { PDFDocument } = require('pdf-lib');

/**
 * Analyze PDF document to determine complexity and optimal strategy
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<Object>} Analysis result with complexity metrics
 */
async function analyzeDocument(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();
  const sizeKB = pdfBuffer.length / 1024;

  const kbPerPage = sizeKB / pageCount;

  // Complexity classification based on KB per page
  // High KB/page usually means: many images, complex tables, dense content
  const complexity = kbPerPage > 100 ? 'high' : kbPerPage > 50 ? 'medium' : 'low';

  // Estimate tokens needed for output based on empirical data:
  // - Simple page (mostly text): ~500-800 output tokens
  // - Medium page (tables): ~1000-1500 output tokens
  // - Complex page (dense tables/images): ~1500-2500 output tokens
  let tokensPerPage;
  switch(complexity) {
    case 'high':
      tokensPerPage = 2000;
      break;
    case 'medium':
      tokensPerPage = 1200;
      break;
    default:
      tokensPerPage = 700;
      break;
  }

  const estimatedOutputTokens = pageCount * tokensPerPage;

  // Determine if chunking is needed
  // Chunk if: estimated tokens > 20000 OR pages > 30
  const needsChunking = estimatedOutputTokens > 20000 || pageCount > 30;

  return {
    pageCount,
    sizeKB: Math.round(sizeKB),
    complexity,
    kbPerPage: Math.round(kbPerPage),
    tokensPerPage,
    estimatedOutputTokens,
    needsChunking
  };
}

/**
 * Select optimal conversion strategy based on analysis
 * @param {Object} analysis - Result from analyzeDocument()
 * @returns {Object} Strategy configuration
 */
function selectStrategy(analysis) {
  const { pageCount, complexity, estimatedOutputTokens, needsChunking } = analysis;

  if (!needsChunking) {
    // Single request strategy - optimal for small/medium documents
    return {
      type: 'single',
      maxTokens: Math.min(estimatedOutputTokens * 1.3, 64000), // 30% buffer, max 64k
      chunks: 1,
      reason: `${pageCount} pages, ${complexity} complexity - single request optimal`
    };
  }

  // Chunking strategy - determine optimal chunk size
  // More complex docs = smaller chunks (more reliable)
  let pagesPerChunk;
  if (complexity === 'high') {
    pagesPerChunk = 5;  // Dense content, small chunks
  } else if (complexity === 'medium') {
    pagesPerChunk = 10; // Medium chunks
  } else {
    pagesPerChunk = 15; // Light content, larger chunks
  }

  const numChunks = Math.ceil(pageCount / pagesPerChunk);

  return {
    type: 'chunked',
    maxTokens: 24000, // Per chunk
    chunks: numChunks,
    pagesPerChunk,
    reason: `${pageCount} pages, ${complexity} complexity - ${numChunks} chunks optimal`
  };
}

module.exports = {
  analyzeDocument,
  selectStrategy
};
