const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.get('/', (req, res, next) => jobController.getAllJobs(req, res, next));

// Protected routes
router.use(authMiddleware.protect);

router.get('/:jobId/match-advice', (req, res, next) => jobController.getAiMatchAdvice(req, res, next));
router.post('/add-json', authMiddleware.restrictTo('admin'), (req, res, next) => jobController.addJobFromJson(req, res, next));
router.post('/import-url', authMiddleware.restrictTo('admin'), (req, res, next) => jobController.importFromUrl(req, res, next));
router.delete('/:id', authMiddleware.restrictTo('admin'), (req, res, next) => jobController.deleteJob(req, res, next));

module.exports = router;
