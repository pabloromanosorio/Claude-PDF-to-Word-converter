const { analyzeDocument, selectStrategy } = require('../lib/pdfAnalyzer');
const { PDFDocument, StandardFonts } = require('pdf-lib');

describe('PDF Analyzer', () => {
  /**
   * Helper to create a test PDF with specified pages
   */
  async function createTestPDF(pageCount, contentPerPage = 'simple') {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.addPage([600, 800]);

      if (contentPerPage === 'complex') {
        // Add more content to increase file size
        for (let j = 0; j < 50; j++) {
          page.drawText(`Line ${j}: This is a complex page with lots of text content to make the file larger`, {
            x: 50,
            y: 750 - (j * 15),
            size: 10,
            font
          });
        }
      } else {
        // Simple content
        page.drawText(`Page ${i + 1}`, {
          x: 50,
          y: 750,
          size: 12,
          font
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  describe('analyzeDocument', () => {
    test('analyzes small simple PDF correctly', async () => {
      const pdfBuffer = await createTestPDF(3, 'simple');
      const analysis = await analyzeDocument(pdfBuffer);

      expect(analysis.pageCount).toBe(3);
      expect(analysis.complexity).toBe('low'); // Small KB/page
      expect(analysis.needsChunking).toBe(false); // Few pages
      expect(analysis.estimatedOutputTokens).toBeLessThan(20000);
    });

    test('analyzes medium PDF correctly', async () => {
      const pdfBuffer = await createTestPDF(20, 'simple');
      const analysis = await analyzeDocument(pdfBuffer);

      expect(analysis.pageCount).toBe(20);
      expect(analysis.needsChunking).toBe(false); // Still under threshold
    });

    test('analyzes large PDF that needs chunking', async () => {
      const pdfBuffer = await createTestPDF(50, 'simple');
      const analysis = await analyzeDocument(pdfBuffer);

      expect(analysis.pageCount).toBe(50);
      expect(analysis.needsChunking).toBe(true); // Over 30 pages
    });

    test('classifies complexity based on KB/page', async () => {
      const simplePdf = await createTestPDF(5, 'simple');
      const complexPdf = await createTestPDF(5, 'complex');

      const simpleAnalysis = await analyzeDocument(simplePdf);
      const complexAnalysis = await analyzeDocument(complexPdf);

      expect(complexAnalysis.kbPerPage).toBeGreaterThan(simpleAnalysis.kbPerPage);
    });

    test('returns all required fields', async () => {
      const pdfBuffer = await createTestPDF(10);
      const analysis = await analyzeDocument(pdfBuffer);

      expect(analysis).toHaveProperty('pageCount');
      expect(analysis).toHaveProperty('sizeKB');
      expect(analysis).toHaveProperty('complexity');
      expect(analysis).toHaveProperty('kbPerPage');
      expect(analysis).toHaveProperty('tokensPerPage');
      expect(analysis).toHaveProperty('estimatedOutputTokens');
      expect(analysis).toHaveProperty('needsChunking');
    });
  });

  describe('selectStrategy', () => {
    test('selects single request for small documents', () => {
      const analysis = {
        pageCount: 5,
        complexity: 'low',
        estimatedOutputTokens: 3500,
        needsChunking: false
      };

      const strategy = selectStrategy(analysis);

      expect(strategy.type).toBe('single');
      expect(strategy.chunks).toBe(1);
      expect(strategy.maxTokens).toBeGreaterThan(3500);
      expect(strategy.maxTokens).toBeLessThanOrEqual(64000);
    });

    test('selects chunking for large documents', () => {
      const analysis = {
        pageCount: 50,
        complexity: 'medium',
        estimatedOutputTokens: 60000,
        needsChunking: true
      };

      const strategy = selectStrategy(analysis);

      expect(strategy.type).toBe('chunked');
      expect(strategy.chunks).toBeGreaterThan(1);
      expect(strategy.pagesPerChunk).toBeDefined();
      expect(strategy.maxTokens).toBe(24000);
    });

    test('uses smaller chunks for high complexity', () => {
      const highComplexity = {
        pageCount: 50,
        complexity: 'high',
        needsChunking: true
      };

      const mediumComplexity = {
        pageCount: 50,
        complexity: 'medium',
        needsChunking: true
      };

      const highStrategy = selectStrategy(highComplexity);
      const mediumStrategy = selectStrategy(mediumComplexity);

      expect(highStrategy.pagesPerChunk).toBeLessThan(mediumStrategy.pagesPerChunk);
      expect(highStrategy.chunks).toBeGreaterThan(mediumStrategy.chunks);
    });

    test('includes descriptive reason', () => {
      const analysis = {
        pageCount: 25,
        complexity: 'low',
        estimatedOutputTokens: 17500,
        needsChunking: false
      };

      const strategy = selectStrategy(analysis);

      expect(strategy.reason).toContain('25 pages');
      expect(strategy.reason).toContain('low complexity');
    });

    test('caps max_tokens at 64000 for single requests', () => {
      const analysis = {
        pageCount: 30,
        complexity: 'high',
        estimatedOutputTokens: 60000,
        needsChunking: false
      };

      const strategy = selectStrategy(analysis);

      expect(strategy.maxTokens).toBeLessThanOrEqual(64000);
    });
  });
});
