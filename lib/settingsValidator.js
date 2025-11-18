/**
 * Settings validation utilities
 */

const VALID_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514'
];

const VALID_FONTS = [
  'Arial',
  'Times New Roman',
  'Calibri',
  'Cambria',
  'Georgia'
];

/**
 * Validate conversion settings
 * @param {Object} settings - Settings object
 * @returns {Object} Validated settings
 * @throws {Error} If validation fails
 */
function validateSettings(settings) {
  if (typeof settings !== 'object' || settings === null) {
    throw new Error('Settings must be an object');
  }

  // Validate model
  if (settings.model && !VALID_MODELS.includes(settings.model)) {
    throw new Error(`Invalid model. Must be one of: ${VALID_MODELS.join(', ')}`);
  }

  // Validate font
  if (settings.font && !VALID_FONTS.includes(settings.font)) {
    throw new Error(`Invalid font. Must be one of: ${VALID_FONTS.join(', ')}`);
  }

  // Validate fontSize
  if (settings.fontSize !== undefined) {
    const size = Number(settings.fontSize);
    if (isNaN(size) || size < 8 || size > 72) {
      throw new Error('fontSize must be between 8 and 72');
    }
  }

  // Validate margins
  if (settings.margins) {
    const { top, bottom, left, right } = settings.margins;
    [top, bottom, left, right].forEach((margin, i) => {
      if (margin !== undefined) {
        const val = Number(margin);
        if (isNaN(val) || val < 0 || val > 10000) {
          throw new Error('Margin values must be between 0 and 10000 DXA');
        }
      }
    });
  }

  // Validate boolean flags
  const booleanFlags = [
    'preserveTableFormatting',
    'preserve_table_formatting',
    'addPageMarkers',
    'add_page_markers',
    'replaceSignatures',
    'replace_signatures',
    'overrideFormatting',
    'override_formatting',
    'enableLogging'
  ];

  booleanFlags.forEach(flag => {
    if (settings[flag] !== undefined && typeof settings[flag] !== 'boolean') {
      throw new Error(`${flag} must be a boolean`);
    }
  });

  // Prevent prototype pollution (check own properties only)
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  dangerousKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      throw new Error(`Dangerous key "${key}" not allowed in settings`);
    }
  });

  return settings;
}

/**
 * Sanitize settings to safe values
 * @param {Object} settings - Settings object
 * @returns {Object} Sanitized settings
 */
function sanitizeSettings(settings) {
  try {
    return validateSettings(settings);
  } catch (error) {
    console.warn('Settings validation failed, using defaults:', error.message);
    return {
      model: 'claude-haiku-4-5-20251001',
      font: 'Arial',
      fontSize: 12,
      preserveTableFormatting: true,
      addPageMarkers: false,
      replaceSignatures: false,
      overrideFormatting: false,
      enableLogging: false
    };
  }
}

module.exports = {
  validateSettings,
  sanitizeSettings,
  VALID_MODELS,
  VALID_FONTS
};
