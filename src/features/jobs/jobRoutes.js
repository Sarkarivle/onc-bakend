const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.get('/', jobController.getAllJobs);

// Protected routes
router.use(authMiddleware.protect);

router.get('/:jobId/match-advice', jobController.getAiMatchAdvice);
router.post('/add-json', authMiddleware.restrictTo('admin'), jobController.addJobFromJson);
router.delete('/:id', authMiddleware.restrictTo('admin'), jobController.deleteJob);

module.exports = router;
