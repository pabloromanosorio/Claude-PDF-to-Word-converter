const { buildConversionPrompt, validateGeneratedCode } = require('./converter');

describe('Converter', () => {
  describe('buildConversionPrompt', () => {
    test('includes critical instructions', () => {
      const settings = {
        model: 'claude-haiku-4-5-20251001',
        font: 'Arial',
        preserveTableFormatting: true
      };
      const workDir = '/tmp/test-123';

      const prompt = buildConversionPrompt(settings, workDir);

      expect(prompt).toContain('/mnt/skills/public/docx/SKILL.md');
      expect(prompt).toContain('/mnt/skills/public/docx/docx-js.md');
      expect(prompt).toContain('ALL pages');
      expect(prompt).toContain(workDir);
    });

    test('includes font preference when specified', () => {
      const settings = { font: 'Times New Roman' };
      const prompt = buildConversionPrompt(settings, '/tmp/test');

      expect(prompt).toContain('Times New Roman');
    });

    test('includes table preservation when enabled', () => {
      const settings = { preserveTableFormatting: true };
      const prompt = buildConversionPrompt(settings, '/tmp/test');

      expect(prompt).toContain('table');
    });
  });

  describe('validateGeneratedCode', () => {
    test('validates code with all required components', () => {
      const validCode = `const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');
fs.writeFileSync('out.docx', buffer);`;

      const result = validateGeneratedCode(validCode);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('detects missing docx import', () => {
      const invalidCode = 'console.log("hello");';

      const result = validateGeneratedCode(invalidCode);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("Missing require('docx')");
    });

    test('detects missing writeFileSync', () => {
      const invalidCode = `const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');`;

      const result = validateGeneratedCode(invalidCode);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("Missing writeFileSync");
    });
  });
});
