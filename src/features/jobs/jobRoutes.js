const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const handle = (fnName) => (req, res, next) => {
    try {
        if (jobController && typeof jobController[fnName] === 'function') {
            return jobController[fnName](req, res, next);
        }
        throw new Error(`Method ${fnName} not found`);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

router.get('/', handle('getAllJobs'));

router.use(authMiddleware.protect);
router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));

// Admin / Scraper Routes
router.get('/admin/discover', handle('discoverNewJobs'));
router.post('/admin/import', handle('importJob')); // Fixed: changed from importFromUrl to importJob
router.patch('/:id', handle('updateJob'));
router.delete('/:id', handle('deleteJob'));

module.exports = router;
