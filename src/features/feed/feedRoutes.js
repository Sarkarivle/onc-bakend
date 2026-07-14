const express = require('express');
const feedController = require('./feedController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const handle = (fnName) => (req, res, next) => {
    try {
        const handler = feedController && feedController[fnName];
        if (typeof handler === 'function') {
            return handler(req, res, next);
        }

        throw new Error(`Feed controller method ${fnName} not found`);
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
};

router.use(authMiddleware.protect);

router.get('/', handle('getFeed'));
router.post('/', handle('createPost'));
router.patch('/:id/like', handle('likePost'));
router.post('/:id/comment', handle('addComment'));

module.exports = router;
