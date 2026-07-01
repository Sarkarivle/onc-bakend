const express = require('express');
const settingsController = require('./settingsController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Robust handler wrapper for async functions
const catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        console.error('🔥 Async Route Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    });
};

// Admin Protection
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

// Routes
router.get('/', catchAsync(settingsController.getAllSettings));
router.post('/update', catchAsync(settingsController.updateSetting));

// Specialized routes (can still be used if needed)
router.route('/api-key')
  .get(catchAsync(settingsController.getApiKey))
  .post(catchAsync(settingsController.updateApiKey));

module.exports = router;
