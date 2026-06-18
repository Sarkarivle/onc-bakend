const express = require('express');
const jansewaController = require('./jansewaController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.get('/', jansewaController.getAllKendras);
router.get('/:id', jansewaController.getKendra);

// Protected routes (Only admin can create)
router.post('/',
    authMiddleware.protect,
    authMiddleware.restrictTo('admin'),
    jansewaController.createKendra
);

module.exports = router;
