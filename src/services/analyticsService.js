const { getRedis } = require('../config/redis');

class AnalyticsService {
    constructor() {
        this.io = null;
        this.redis = null;
    }

    init(io) {
        this.io = io;
        this.redis = getRedis();
    }

    // Mock trackMessage for compatibility with chatUtils
    trackMessage() {
        // Implementation can be added if needed
    }
}

module.exports = new AnalyticsService();
