const express = require('express');
const settingsController = require('./settingsController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const handle = (fnName) => (req, res, next) => {
    if (settingsController && typeof settingsController[fnName] === 'function') {
        return settingsController[fnName](req, res, next);
    }
    res.status(500).json({ status: 'error', message: `Controller method ${fnName} not found` });
};

router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

router.get('/', handle('getAllSettings'));
router.post('/update', handle('updateSetting'));

router.route('/api-key')
  .get(handle('getApiKey'))
  .post(handle('updateApiKey'));

module.exports = router;
