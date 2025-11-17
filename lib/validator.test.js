const { validateUpload } = require('./validator');

describe('Validator', () => {
  describe('validateUpload', () => {
    test('accepts valid PDF', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test')
      };

      expect(() => validateUpload(file)).not.toThrow();
    });

    test('rejects missing file', () => {
      expect(() => validateUpload(null)).toThrow('No file uploaded');
    });

    test('rejects oversized file', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024, // 11MB
        buffer: Buffer.from('test')
      };

      expect(() => validateUpload(file)).toThrow('File too large');
    });

    test('rejects non-PDF file', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test')
      };

      expect(() => validateUpload(file)).toThrow('Only PDF files allowed');
    });

    test('rejects empty file', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 0,
        buffer: Buffer.from('')
      };

      expect(() => validateUpload(file)).toThrow('Empty file');
    });
  });
});
