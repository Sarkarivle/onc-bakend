const express = require('express');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Safety function: Agar controller nahi bhi mila toh crash nahi hoga
const safe = (name) => (req, res, next) => {
    try {
        const controller = require('./jobController');
        if (controller && controller[name]) {
            return controller[name](req, res, next);
        }
        console.error(`ERROR: Method ${name} not found in jobController`);
        res.status(500).json({ status: 'error', message: 'Controller method not found' });
    } catch (err) {
        console.error('ERROR loading jobController:', err.message);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

// Route handlers (Wrapped in arrow functions for extra safety)
router.get('/', (req, res, next) => safe('getAllJobs')(req, res, next));

router.use(authMiddleware.protect);

router.get('/:jobId/match-advice', (req, res, next) => safe('getAiMatchAdvice')(req, res, next));
router.post('/add-json', authMiddleware.restrictTo('admin'), (req, res, next) => safe('addJobFromJson')(req, res, next));
router.post('/import-url', authMiddleware.restrictTo('admin'), (req, res, next) => safe('importFromUrl')(req, res, next));
router.delete('/:id', authMiddleware.restrictTo('admin'), (req, res, next) => safe('deleteJob')(req, res, next));

module.exports = router;
