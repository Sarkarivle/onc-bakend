const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Safety wrapper to prevent crashes
const handle = (fnName) => (req, res, next) => {
    if (jobController && typeof jobController[fnName] === 'function') {
        return jobController[fnName](req, res, next);
    }
    res.status(500).json({ status: 'error', message: `Controller method ${fnName} not found` });
};

router.get('/', handle('getAllJobs'));

router.use(authMiddleware.protect);

router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));
router.post('/add-json', authMiddleware.restrictTo('admin'), handle('addJobFromJson'));
router.post('/import-url', authMiddleware.restrictTo('admin'), handle('importFromUrl'));
router.delete('/:id', authMiddleware.restrictTo('admin'), handle('deleteJob'));

module.exports = router;
