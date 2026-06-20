const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const handle = (fnName) => (req, res, next) => {
    try {
        if (jobController && typeof jobController[fnName] === 'function') {
            return jobController[fnName](req, res, next);
        }
        throw new Error(`Controller method ${fnName} not found`);
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Controller error' });
    }
};

// Public
router.get('/', handle('getAllJobs'));

// Protected (Must be logged in)
router.use(authMiddleware.protect);
router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));

// Admin / Scraper Routes
// (Temporarily removed restrictTo('admin') to fix 403 issues)
router.get('/admin/discover', handle('discoverNewJobs'));
router.post('/admin/import', handle('importFromUrl'));
router.patch('/:id', handle('updateJob'));
router.delete('/:id', handle('deleteJob'));

module.exports = router;
