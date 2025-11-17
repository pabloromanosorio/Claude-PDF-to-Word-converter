/**
 * File validation utilities
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
  if (file.mimetype !== 'application/pdf') {
    throw new Error('Only PDF files allowed');
  }
}

module.exports = {
  validateUpload
};
