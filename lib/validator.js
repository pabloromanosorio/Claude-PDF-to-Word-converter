/**
 * File validation utilities
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Supported file types (PDFs and images)
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

/**
 * Validate uploaded file
 * @param {Object} file - Uploaded file from multer
 * @throws {Error} If validation fails
 */
function validateUpload(file) {
  // Check file exists
  if (!file) {
    throw new Error('No file uploaded');
  }

  // Check file size
  if (file.size === 0) {
    throw new Error('Empty file');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large (max 10MB)');
  }

  // Check file type
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    throw new Error('Only PDF and image files (JPEG, PNG, GIF, WebP) allowed');
  }

  // For images, check size limits (Anthropic API: max 5MB per image)
  if (file.mimetype.startsWith('image/') && file.size > 5 * 1024 * 1024) {
    throw new Error('Image files must be 5MB or smaller');
  }
}

module.exports = {
  validateUpload,
  ALLOWED_MIMETYPES
};
