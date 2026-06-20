const express = require('express');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Robust handler that loads the controller only when needed
const handle = (fnName) => (req, res, next) => {
    try {
        const jobController = require('./jobController');
        if (jobController && typeof jobController[fnName] === 'function') {
            return jobController[fnName](req, res, next);
        }
        throw new Error(`Controller method ${fnName} not found`);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

router.get('/', handle('getAllJobs'));

router.use(authMiddleware.protect);

router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));
router.post('/add-json', authMiddleware.restrictTo('admin'), handle('addJobFromJson'));
router.post('/import-url', authMiddleware.restrictTo('admin'), handle('importFromUrl'));
router.delete('/:id', authMiddleware.restrictTo('admin'), handle('deleteJob'));

module.exports = router;
