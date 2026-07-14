const express = require('express');
const sourceController = require('./sourceController');
const { protect, restrictTo } = require('../../middlewares/authMiddleware');

const router = express.Router();

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.use(protect);
router.use(restrictTo('admin'));

router.get('/', catchAsync(sourceController.listSources));
router.post('/', catchAsync(sourceController.upsertSource));
router.get('/health', catchAsync(sourceController.health));
router.post('/refresh-due', catchAsync(sourceController.refreshDue));
router.post('/:id/refresh', catchAsync(sourceController.refreshSource));

module.exports = router;
