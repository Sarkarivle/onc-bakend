const express = require('express');
const feedController = require('./feedController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', (req, res) => feedController.getFeed(req, res));
router.post('/', (req, res) => feedController.createPost(req, res));
router.patch('/:id/like', (req, res) => feedController.likePost(req, res));
router.post('/:id/comment', (req, res) => feedController.addComment(req, res));

module.exports = router;
