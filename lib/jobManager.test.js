const JobManager = require('./jobManager');

describe('JobManager', () => {
  let manager;

  beforeEach(() => {
    manager = new JobManager();
  });

  test('creates job with unique ID', () => {
    const job = manager.createJob('test.pdf', 1024);

    expect(job.id).toBeDefined();
    expect(job.filename).toBe('test.pdf');
    expect(job.fileSize).toBe(1024);
    expect(job.status).toBe('queued');
  });

  test('retrieves job by ID', () => {
    const created = manager.createJob('test.pdf', 1024);
    const retrieved = manager.getJob(created.id);

    expect(retrieved).toEqual(created);
  });

  test('updates job status', () => {
    const job = manager.createJob('test.pdf', 1024);

    manager.updateJob(job.id, {
      status: 'processing',
      progress: 50
    });

    const updated = manager.getJob(job.id);
    expect(updated.status).toBe('processing');
    expect(updated.progress).toBe(50);
  });

  test('deletes job', () => {
    const job = manager.createJob('test.pdf', 1024);

    manager.deleteJob(job.id);

    const retrieved = manager.getJob(job.id);
    expect(retrieved).toBeNull();
  });

  test('cleans up old jobs', () => {
    const job = manager.createJob('test.pdf', 1024);

    // Manually set old timestamp (1 hour + 1 minute ago)
    job.createdAt = Date.now() - (61 * 60 * 1000);

    manager.cleanupOldJobs();

    const retrieved = manager.getJob(job.id);
    expect(retrieved).toBeNull();
  });
});
