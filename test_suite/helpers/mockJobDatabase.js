/**
 * Mock Job Database
 * Responsibility: Provide a mock database interface for data-driven tests.
 * This allows testing of data routing logic without a real database connection.
 */

class MockJobDatabase {
    constructor(initialData = {}) {
        this.activeJobs = initialData.activeJobs || [];
        this.expiredJobs = initialData.expiredJobs || [];
    }

    // Add methods to find, filter, and manage jobs as needed for tests.
    findLatestJobs(query) {
        return this.activeJobs.filter(job => job.title.toLowerCase().includes(query.toLowerCase()));
    }
}

module.exports = MockJobDatabase;