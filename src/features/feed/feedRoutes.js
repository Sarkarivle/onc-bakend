const express = require('express');
const feedController = require('./feedController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', (req, res, next) => {
    if (feedController.getFeed) return feedController.getFeed(req, res, next);
    res.status(500).json({ error: 'getFeed method not found' });
});

router.post('/', (req, res, next) => {
    if (feedController.createPost) return feedController.createPost(req, res, next);
    res.status(500).json({ error: 'createPost method not found' });
});

router.patch('/:id/like', (req, res, next) => {
    if (feedController.likePost) return feedController.likePost(req, res, next);
    res.status(500).json({ error: 'likePost method not found' });
});

router.post('/:id/comment', (req, res, next) => {
    if (feedController.addComment) return feedController.addComment(req, res, next);
    res.status(500).json({ error: 'addComment method not found' });
});

module.exports = router;
