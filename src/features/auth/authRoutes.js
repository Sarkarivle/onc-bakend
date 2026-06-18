const express = require('express');
const authController = require('./authController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);

// Protected routes
router.use(authMiddleware.protect);
router.get('/me', authController.getMe);
router.patch('/updateMe', authController.updateMe);

module.exports = router;
