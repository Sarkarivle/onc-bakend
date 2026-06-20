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

// Sabhi ko dikhega
router.get('/', handle('getAllJobs'));

// Login hona zaroori hai
router.use(authMiddleware.protect);
router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));

// SIRF ADMIN KE LIYE
router.get('/admin/discover', authMiddleware.restrictTo('admin'), handle('discoverNewJobs'));
router.post('/admin/import', authMiddleware.restrictTo('admin'), handle('importFromUrl'));
router.patch('/:id', authMiddleware.restrictTo('admin'), handle('updateJob'));
router.delete('/:id', authMiddleware.restrictTo('admin'), handle('deleteJob'));

module.exports = router;
