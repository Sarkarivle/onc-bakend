const express = require('express');
const jobController = require('./jobController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const safeHandler = (handler, actionName) => {
  return (req, res, next) => {
	if (typeof handler === 'function') {
	  return handler(req, res, next);
	}

	console.error(`Job route handler missing: ${actionName}`);
	return res.status(500).json({
	  status: 'fail',
	  message: `Route handler not available: ${actionName}`,
	});
  };
};

router.get('/', safeHandler(jobController.getAllJobs, 'getAllJobs'));

// Protected routes
router.use(authMiddleware.protect);

router.get('/:jobId/match-advice', safeHandler(jobController.getAiMatchAdvice, 'getAiMatchAdvice'));
router.post('/add-json', authMiddleware.restrictTo('admin'), safeHandler(jobController.addJobFromJson, 'addJobFromJson'));
router.post('/import-url', authMiddleware.restrictTo('admin'), safeHandler(jobController.importFromUrl, 'importFromUrl'));
router.delete('/:id', authMiddleware.restrictTo('admin'), safeHandler(jobController.deleteJob, 'deleteJob'));

module.exports = router;
