const express = require('express');
const feedController = require('./feedController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', feedController.getFeed);
router.post('/', feedController.createPost);
router.patch('/:id/like', feedController.likePost);
router.post('/:id/comment', feedController.addComment);

module.exports = router;
