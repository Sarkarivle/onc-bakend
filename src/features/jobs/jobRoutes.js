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
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

// 1. PUBLIC ROUTES
router.get('/', handle('getAllJobs'));

// 2. LOGGED IN USER ROUTES
router.use(authMiddleware.protect);
router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));

// 3. ADMIN ONLY ROUTES
router.get('/admin/discover', authMiddleware.restrictTo('admin', 'expert'), handle('discoverNewJobs'));
router.post('/admin/import', authMiddleware.restrictTo('admin', 'expert'), handle('importFromUrl'));
router.patch('/:id', authMiddleware.restrictTo('admin', 'expert'), handle('updateJob'));
router.delete('/:id', authMiddleware.restrictTo('admin', 'expert'), handle('deleteJob'));

module.exports = router;
