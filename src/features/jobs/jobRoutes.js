const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.get('/', jobController.getAllJobs);

// Protected routes (Admin only)
router.post('/', authMiddleware.protect, authMiddleware.restrictTo('admin'), jobController.createJob);
router.post('/add-json', authMiddleware.protect, authMiddleware.restrictTo('admin'), jobController.addJobFromJson);
router.delete('/:id', authMiddleware.protect, authMiddleware.restrictTo('admin'), jobController.deleteJob);

module.exports = router;
