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
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

router.get('/', handle('getAllJobs'));

router.use(authMiddleware.protect);
router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));

// ADMIN ONLY
router.use(authMiddleware.restrictTo('admin'));
router.get('/admin/discover', handle('discoverNewJobs'));
router.post('/admin/import', handle('importFromUrl'));
router.patch('/:id', handle('updateJob')); // <-- Naya edit route
router.delete('/:id', handle('deleteJob'));

module.exports = router;
