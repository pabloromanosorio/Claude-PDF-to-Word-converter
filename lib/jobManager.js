const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

/**
 * In-memory job management with persistence
 */
class JobManager {
  constructor() {
    this.jobs = new Map();

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load stats
    this.stats = this.loadStats();

    // Start periodic cleanup (every 10 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, 10 * 60 * 1000);

    // Register cleanup handlers for graceful shutdown
    this.registerShutdownHandlers();
  }

  /**
   * Load stats from disk
   */
  loadStats() {
    try {
      if (fs.existsSync(STATS_FILE)) {
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }

    return {
      total_conversions: 0,
      total_pages: 0,
      total_cost: 0
    };
  }

  /**
   * Save stats to disk
   */
  saveStats() {
    try {
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      console.error('Failed to save stats:', error);
    }
  }

  /**
   * Register handlers for graceful shutdown
   */
  registerShutdownHandlers() {
    const shutdown = () => {
      console.log('Shutting down JobManager...');
      this.saveStats();
      this.destroy();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('exit', shutdown);
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

      // If job completed, update stats
      if (updates.status === 'completed' && !job.statsRecorded) {
        this.stats.total_conversions++;
        this.stats.total_cost += (job.actualCost || 0);
        // We don't track pages yet, but if we did:
        // this.stats.total_pages += (job.pages || 0);

        job.statsRecorded = true;
        this.saveStats();
      }
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
   * Clean up jobs older than 24 hours (increased from 1 hour)
   */
  cleanupOldJobs() {
    const now = Date.now();
    const retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

    for (const [jobId, job] of this.jobs.entries()) {
      if (now - job.createdAt > retentionPeriod) {
        this.jobs.delete(jobId);

        // Also try to delete the output file if it exists
        if (job.outputPath && fs.existsSync(job.outputPath)) {
          try {
            fs.unlinkSync(job.outputPath);
            // Also try to remove the parent directory if it's empty/job-specific
            const dir = path.dirname(job.outputPath);
            if (dir.includes('conversion-')) {
              fs.rmdirSync(dir);
            }
          } catch (e) {
            console.error(`Failed to cleanup file for job ${jobId}:`, e);
          }
        }
      }
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return this.stats;
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
