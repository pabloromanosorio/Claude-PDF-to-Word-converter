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

      expect(prompt).toContain('Read /mnt/skills/public/docx/SKILL.md');
      expect(prompt).toContain('Read /mnt/skills/public/docx/docx-js.md');
      expect(prompt).toContain('ALL PAGES');
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
    test('accepts valid docx code', () => {
      const validCode = 'const { Document, Packer } = require("docx");';

      expect(() => validateGeneratedCode(validCode)).not.toThrow();
    });

    test('rejects code without Document import', () => {
      const invalidCode = 'console.log("hello");';

      expect(() => validateGeneratedCode(invalidCode)).toThrow('Invalid code');
    });

    test('removes markdown code blocks', () => {
      const codeWithMarkdown = '```javascript\nconst { Document, Packer } = require("docx");\n```';
      const cleaned = validateGeneratedCode(codeWithMarkdown);

      expect(cleaned).not.toContain('```');
      expect(cleaned).toContain('Document');
    });

    test('detects syntax errors in generated code', () => {
      const invalidSyntax = 'const { Document, Packer } = require("docx"); const arr = [1, 2, 3]];';

      expect(() => validateGeneratedCode(invalidSyntax)).toThrow('Syntax error');
    });

    test('detects mismatched brackets', () => {
      const mismatchedBrackets = 'const { Document, Packer } = require("docx"); { const x = [1, 2, 3];';

      expect(() => validateGeneratedCode(mismatchedBrackets)).toThrow('Syntax error');
    });
  });
});
