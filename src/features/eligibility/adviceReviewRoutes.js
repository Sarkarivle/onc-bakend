const express = require('express');
const adviceReviewController = require('./adviceReviewController');
const { protect, restrictTo } = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(protect, restrictTo('admin'));

router.get('/stats', adviceReviewController.getStats);
router.get('/alert-check', adviceReviewController.checkAlert);
router.get('/', adviceReviewController.listFeedback);

module.exports = router;
