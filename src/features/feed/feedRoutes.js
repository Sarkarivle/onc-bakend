const express = require('express');
const feedController = require('./feedController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.route('/')
  .get(feedController.getFeed)
  .post(feedController.createPost);

router.patch('/:id/like', feedController.likePost);

module.exports = router;
