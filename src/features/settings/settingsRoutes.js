const express = require('express');
const settingsController = require('./settingsController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const handle = (fnName) => (req, res, next) => {
    try {
        const settingsController = require('./settingsController');
        if (settingsController && typeof settingsController[fnName] === 'function') {
            return settingsController[fnName](req, res, next);
        }
        throw new Error(`Controller method ${fnName} not found`);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

router.get('/', handle('getAllSettings'));
router.post('/update', handle('updateSetting'));

router.route('/api-key')
  .get(handle('getApiKey'))
  .post(handle('updateApiKey'));

module.exports = router;
