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

// PUBLIC ROUTES
router.get('/', handle('getAllJobs'));

// PROTECTED ROUTES
router.use(authMiddleware.protect);
router.get('/:jobId/match-advice', handle('getAiMatchAdvice'));

// ADMIN ONLY CONTROL ROUTES
router.use(authMiddleware.restrictTo('admin'));

// Scraper Control
router.get('/admin/discover', handle('discoverNewJobs')); // Naye links dhoondhne ke liye
router.post('/admin/import', handle('importFromUrl'));    // Link se AI setup karne ke liye
router.post('/add-json', handle('addJobFromJson'));
router.delete('/:id', handle('deleteJob'));

module.exports = router;
