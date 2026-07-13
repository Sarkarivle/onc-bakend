const express = require('express');
const authController = require('./authController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const handle = (fnName) => (req, res, next) => {
    if (authController && typeof authController[fnName] === 'function') {
        return authController[fnName](req, res, next);
    }
    res.status(500).json({ status: 'error', message: `Auth method ${fnName} not found` });
};

router.post('/signup', handle('signup'));
router.post('/login', handle('login'));
router.post('/send-otp', handle('sendOTP'));

// Protected routes
router.use(authMiddleware.protect);
router.get('/me', handle('getMe'));
router.patch('/updateMe', handle('updateMe'));

module.exports = router;
