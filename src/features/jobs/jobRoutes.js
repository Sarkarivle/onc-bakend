const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Safety wrapper to prevent crashes if controller methods are missing
const safeCall = (method) => (req, res, next) => {
    if (jobController && typeof jobController[method] === 'function') {
        return jobController[method](req, res, next);
    }
    console.error(`Method ${method} not found in jobController`);
    res.status(500).json({ status: 'error', message: 'Internal Server Error: Controller not initialized' });
};

router.get('/', safeCall('getAllJobs'));

// Protected routes
router.use(authMiddleware.protect);

router.get('/:jobId/match-advice', safeCall('getAiMatchAdvice'));
router.post('/add-json', authMiddleware.restrictTo('admin'), safeCall('addJobFromJson'));
router.post('/import-url', authMiddleware.restrictTo('admin'), safeCall('importFromUrl'));
router.delete('/:id', authMiddleware.restrictTo('admin'), safeCall('deleteJob'));

module.exports = router;
