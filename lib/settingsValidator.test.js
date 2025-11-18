const { validateSettings, sanitizeSettings, VALID_MODELS, VALID_FONTS } = require('./settingsValidator');

describe('SettingsValidator', () => {
  describe('validateSettings', () => {
    test('accepts valid settings', () => {
      const validSettings = {
        model: 'claude-haiku-4-5-20251001',
        font: 'Arial',
        fontSize: 12,
        margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        preserveTableFormatting: true,
        addPageMarkers: false,
        replaceSignatures: true,
        overrideFormatting: false,
        enableLogging: true
      };

      expect(() => validateSettings(validSettings)).not.toThrow();
    });

    test('rejects invalid model', () => {
      const invalidSettings = { model: 'invalid-model' };

      expect(() => validateSettings(invalidSettings)).toThrow('Invalid model');
    });

    test('rejects invalid font', () => {
      const invalidSettings = { font: 'Comic Sans' };

      expect(() => validateSettings(invalidSettings)).toThrow('Invalid font');
    });

    test('rejects invalid fontSize', () => {
      const invalidSettings = { fontSize: 100 };

      expect(() => validateSettings(invalidSettings)).toThrow('fontSize must be between');
    });

    test('rejects prototype pollution attempts', () => {
      // Create object with __proto__ as own property using JSON parse
      const dangerousJSON = '{"__proto__": {"polluted": true}}';
      const dangerousSettings = JSON.parse(dangerousJSON);

      expect(() => validateSettings(dangerousSettings)).toThrow('Dangerous key');
    });

    test('rejects non-boolean flags', () => {
      const invalidSettings = { enableLogging: 'true' };

      expect(() => validateSettings(invalidSettings)).toThrow('must be a boolean');
    });

    test('accepts both camelCase and snake_case keys', () => {
      const camelCase = { preserveTableFormatting: true };
      const snakeCase = { preserve_table_formatting: true };

      expect(() => validateSettings(camelCase)).not.toThrow();
      expect(() => validateSettings(snakeCase)).not.toThrow();
    });
  });

  describe('sanitizeSettings', () => {
    test('returns default settings for invalid input', () => {
      const invalidSettings = { model: 'invalid' };
      const sanitized = sanitizeSettings(invalidSettings);

      expect(sanitized.model).toBe('claude-haiku-4-5-20251001');
      expect(sanitized.font).toBe('Arial');
    });

    test('passes through valid settings', () => {
      const validSettings = { model: 'claude-haiku-4-5-20251001', font: 'Arial' };
      const sanitized = sanitizeSettings(validSettings);

      expect(sanitized.model).toBe('claude-haiku-4-5-20251001');
      expect(sanitized.font).toBe('Arial');
    });
  });
});
