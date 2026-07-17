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

router.get('/my-matches', handle('getMyMatches'));
router.post('/', handle('createJob'));

// Admin / Scraper Routes
router.get('/admin/discover', handle('discoverNewJobs'));
router.post('/admin/import', handle('importJob'));

router.get('/:id', handle('getJob'));
router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));
router.get('/:jobId/match-advice/stream', handle('getAiMatchAdviceStream'));
router.post('/:jobId/advice-feedback', handle('submitAdviceFeedback'));
router.patch('/:id', handle('updateJob'));
router.delete('/:id', handle('deleteJob'));

module.exports = router;
