const express = require('express');
const settingsController = require('./settingsController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// All settings routes are protected and restricted to admin
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

// Generic settings routes
router.get('/', settingsController.getAllSettings);
router.post('/update', settingsController.updateSetting);

// Legacy/Specific routes
router
  .route('/api-key')
  .get(settingsController.getApiKey)
  .post(settingsController.updateApiKey);

module.exports = router;
