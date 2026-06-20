const express = require('express');
const jansewaController = require('./jansewaController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

const handle = (fnName) => (req, res, next) => {
    try {
        const jansewaController = require('./jansewaController');
        if (jansewaController && typeof jansewaController[fnName] === 'function') {
            return jansewaController[fnName](req, res, next);
        }
        throw new Error(`Controller method ${fnName} not found`);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

router.get('/', handle('getAllKendras'));
router.get('/:id', handle('getKendra'));

router.post('/',
    authMiddleware.protect,
    authMiddleware.restrictTo('admin'),
    handle('createKendra')
);

module.exports = router;
