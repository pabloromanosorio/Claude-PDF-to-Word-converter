const crypto = require('crypto');

/**
 * In-memory job management
 */
class JobManager {
  constructor() {
    this.jobs = new Map();

    // Start periodic cleanup (every 10 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, 10 * 60 * 1000);
  }

  /**
   * Create a new job
   * @param {string} filename - Original filename
   * @param {number} fileSize - File size in bytes
   * @param {Object} settings - Conversion settings
   * @returns {Object} Created job
   */
  createJob(filename, fileSize, settings = {}) {
    const job = {
      id: crypto.randomUUID(),
      filename,
      fileSize,
      settings,
      status: 'queued',
      progress: 0,
      currentStep: 'Initializing...',
      outputPath: null,
      error: null,
      inputTokens: null,
      outputTokens: null,
      actualCost: null,
      createdAt: Date.now(),
      completedAt: null
    };

    this.jobs.set(job.id, job);
    return job;
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Object|null} Job or null if not found
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Update job
   * @param {string} jobId - Job ID
   * @param {Object} updates - Fields to update
   */
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
    }
  }

  /**
   * Delete job
   * @param {string} jobId - Job ID
   */
  deleteJob(jobId) {
    this.jobs.delete(jobId);
  }

  /**
   * Clean up jobs older than 1 hour
   */
  cleanupOldJobs() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [jobId, job] of this.jobs.entries()) {
      if (now - job.createdAt > oneHour) {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Stop cleanup interval (for testing)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = JobManager;
