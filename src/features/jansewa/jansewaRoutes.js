const express = require('express');
const jansewaController = require('./jansewaController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const handle = (fnName) => (req, res, next) => {
    if (jansewaController && typeof jansewaController[fnName] === 'function') {
        return jansewaController[fnName](req, res, next);
    }
    res.status(500).json({ status: 'error', message: `Controller method ${fnName} not found` });
};

router.get('/', handle('getAllKendras'));
router.get('/:id', handle('getKendra'));

router.post('/',
    authMiddleware.protect,
    authMiddleware.restrictTo('admin'),
    handle('createKendra')
);

module.exports = router;
