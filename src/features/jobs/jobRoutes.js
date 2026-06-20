const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Wrap in arrow functions to avoid "got Undefined" error during route registration
// even if there are circular dependencies or loading order issues.
router.get('/', (req, res, next) => {
    if (jobController && jobController.getAllJobs) {
        return jobController.getAllJobs(req, res, next);
    }
    res.status(500).json({ status: 'error', message: 'Controller not initialized' });
});

// Protected routes
router.use(authMiddleware.protect);

router.get('/:jobId/match-advice', (req, res, next) => {
    if (jobController && jobController.getAiMatchAdvice) {
        return jobController.getAiMatchAdvice(req, res, next);
    }
    res.status(500).json({ status: 'error', message: 'Controller not initialized' });
});

router.post('/add-json', authMiddleware.restrictTo('admin'), (req, res, next) => {
    if (jobController && jobController.addJobFromJson) {
        return jobController.addJobFromJson(req, res, next);
    }
    res.status(500).json({ status: 'error', message: 'Controller not initialized' });
});

router.post('/import-url', authMiddleware.restrictTo('admin'), (req, res, next) => {
    if (jobController && jobController.importFromUrl) {
        return jobController.importFromUrl(req, res, next);
    }
    res.status(500).json({ status: 'error', message: 'Controller not initialized' });
});

router.delete('/:id', authMiddleware.restrictTo('admin'), (req, res, next) => {
    if (jobController && jobController.deleteJob) {
        return jobController.deleteJob(req, res, next);
    }
    res.status(500).json({ status: 'error', message: 'Controller not initialized' });
});

module.exports = router;
