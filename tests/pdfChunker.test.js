const { splitPdfIntoChunks, mergeChunkCodes } = require('../lib/pdfChunker');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Helper to create a simple test PDF
async function createTestPdf(pageCount) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage([612, 792]); // Letter size
    page.drawText(`Page ${i + 1} of ${pageCount}`, {
      x: 50,
      y: 750,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

describe('pdfChunker', () => {
  describe('splitPdfIntoChunks', () => {
    test('splits 10-page PDF into 2 chunks of 5 pages', async () => {
      const pdfBuffer = await createTestPdf(10);
      const chunks = await splitPdfIntoChunks(pdfBuffer, 5);

      expect(chunks).toHaveLength(2);

      expect(chunks[0].index).toBe(0);
      expect(chunks[0].startPage).toBe(1);
      expect(chunks[0].endPage).toBe(5);
      expect(chunks[0].totalPages).toBe(10);
      expect(chunks[0].buffer).toBeInstanceOf(Buffer);
      expect(chunks[0].base64).toBeTruthy();

      expect(chunks[1].index).toBe(1);
      expect(chunks[1].startPage).toBe(6);
      expect(chunks[1].endPage).toBe(10);
      expect(chunks[1].totalPages).toBe(10);
    });

    test('handles uneven page distribution', async () => {
      const pdfBuffer = await createTestPdf(13);
      const chunks = await splitPdfIntoChunks(pdfBuffer, 5);

      expect(chunks).toHaveLength(3);

      expect(chunks[0].endPage - chunks[0].startPage + 1).toBe(5);
      expect(chunks[1].endPage - chunks[1].startPage + 1).toBe(5);
      expect(chunks[2].endPage - chunks[2].startPage + 1).toBe(3); // Last chunk has 3 pages
    });

    test('single chunk for small PDF', async () => {
      const pdfBuffer = await createTestPdf(3);
      const chunks = await splitPdfIntoChunks(pdfBuffer, 10);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].startPage).toBe(1);
      expect(chunks[0].endPage).toBe(3);
    });

    test('each chunk has valid base64 and buffer', async () => {
      const pdfBuffer = await createTestPdf(6);
      const chunks = await splitPdfIntoChunks(pdfBuffer, 3);

      for (const chunk of chunks) {
        expect(chunk.buffer).toBeInstanceOf(Buffer);
        expect(chunk.base64).toBeTruthy();
        expect(typeof chunk.base64).toBe('string');

        // Verify it's valid base64
        const decoded = Buffer.from(chunk.base64, 'base64');
        expect(decoded).toBeInstanceOf(Buffer);
      }
    });

    test('chunk buffers can be loaded as valid PDFs', async () => {
      const pdfBuffer = await createTestPdf(8);
      const chunks = await splitPdfIntoChunks(pdfBuffer, 4);

      for (const chunk of chunks) {
        // Should be able to load the chunk as a PDF
        const chunkPdf = await PDFDocument.load(chunk.buffer);
        const expectedPages = chunk.endPage - chunk.startPage + 1;
        expect(chunkPdf.getPageCount()).toBe(expectedPages);
      }
    });
  });

  describe('mergeChunkCodes', () => {
    test('returns single code if only one chunk', () => {
      const codes = ['const doc = new Document();'];
      const merged = mergeChunkCodes(codes);
      expect(merged).toBe('const doc = new Document();');
    });

    test('merges multiple chunks with content extraction', () => {
      const chunk1 = `const { Document } = require('docx');
const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ text: 'First' })
    ]
  }]
});`;

      const chunk2 = `new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ text: 'Second' })
    ]
  }]
})`;

      const chunk3 = `new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ text: 'Third' })
    ]
  }]
});
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('out.docx', buffer);
});`;

      const codes = [chunk1, chunk2, chunk3];
      const merged = mergeChunkCodes(codes);

      expect(merged).toContain('First');
      expect(merged).toContain('Packer.toBuffer');
    });

    test('preserves Packer.toBuffer from last chunk', () => {
      const chunk1 = `const { Document, Packer } = require('docx');
const fs = require('fs');
const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ text: 'Content' })
    ]
  }]
});`;

      const chunk2 = `Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('output.docx', buffer);
});`;

      const codes = [chunk1, chunk2];
      const merged = mergeChunkCodes(codes);

      expect(merged).toContain('Packer.toBuffer');
      expect(merged).toContain('writeFileSync');
      expect(merged).toContain('output.docx');
    });

    test('throws error for empty array', () => {
      expect(() => mergeChunkCodes([])).toThrow('No chunk codes to merge');
    });
  });
});
