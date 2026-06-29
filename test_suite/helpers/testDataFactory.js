/**
 * Test Data Factory
 * Responsibility: Generate consistent and reusable test data objects.
 * This helps in creating scalable and maintainable test cases.
 */

const createJob = (overrides = {}) => {
    const now = new Date();
    const futureDate = new Date(now.setDate(now.getDate() + 30)).toISOString().split('T')[0];

    return {
        id: `job_${Math.floor(Math.random() * 10000)}`,
        title: 'Generic Test Job',
        lastDate: futureDate,
        isVerified: true,
        ...overrides,
    };
};

const createExpiredJob = (overrides = {}) => {
    return createJob({ lastDate: '2020-01-01', ...overrides });
};

module.exports = { createJob, createExpiredJob };