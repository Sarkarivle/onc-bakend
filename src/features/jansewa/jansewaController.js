const Jansewa = require('./jansewaModel');
const RazorpayPayment = require('./razorpayPaymentModel');
const User = require('../auth/userModel');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');

const DEFAULT_RAZORPAY_OFFERS = {
  jansewa_form_help: { title: 'Govt Job Form Filling', amount: 9900, currency: 'INR', premiumDays: 7 },
  pan_card_application: { title: 'Pan Card Application', amount: 15000, currency: 'INR', premiumDays: 15 },
  certificate_service: { title: 'Income/Caste Certificate', amount: 10000, currency: 'INR', premiumDays: 7 },
  passport_service: { title: 'Passport Services', amount: 20000, currency: 'INR', premiumDays: 30 }
};

const getRazorpayOffers = () => {
  if (!process.env.RAZORPAY_PREMIUM_OFFERS_JSON) return DEFAULT_RAZORPAY_OFFERS;
  try {
    return JSON.parse(process.env.RAZORPAY_PREMIUM_OFFERS_JSON);
  } catch (err) {
    console.warn('[Razorpay] Invalid RAZORPAY_PREMIUM_OFFERS_JSON. Using defaults.');
    return DEFAULT_RAZORPAY_OFFERS;
  }
};

const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!orderId || !paymentId || !signature || !secret) return true;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
};

const fetchRazorpayPayment = async (paymentId) => {
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_TDfgsIEYukPaSk';
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    const err = new Error('Razorpay secret key is not configured on server');
    err.statusCode = 500;
    throw err;
  }

  const response = await axios.get(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    auth: { username: keyId, password: keySecret },
    timeout: 10000
  });
  return response.data;
};

const calculatePremiumUntil = (currentPremiumUntil, premiumDays) => {
  const now = new Date();
  const base = currentPremiumUntil && currentPremiumUntil > now ? currentPremiumUntil : now;
  return new Date(base.getTime() + premiumDays * 24 * 60 * 60 * 1000);
};

const VALID_CATEGORIES = [
  'Jansewa Kendra',
  'Student Rooms',
  'Tiffin Service',
  'Book Store',
  'Coaching',
  'Home Tutors',
  'Stationary'
];

const normalizeCategory = (category) => {
  if (!category) return 'Jansewa Kendra';
  const value = String(category).trim().replace(/\s+/g, ' ');
  return VALID_CATEGORIES.find(item => item.toLowerCase() === value.toLowerCase()) || value;
};

const normalizeStatus = (status, fallback = 'pending') => {
  const value = String(status || fallback).trim().toLowerCase();
  return ['pending', 'approved', 'rejected'].includes(value) ? value : fallback;
};

const exactTextRegex = (value) => {
  const escaped = String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*$`, 'i');
};

const getAllKendras = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.category) {
      const category = normalizeCategory(req.query.category);
      filter.category = exactTextRegex(category);
    }
    if (req.query.status && req.query.status !== 'all') filter.status = exactTextRegex(normalizeStatus(req.query.status));
    else if (!req.query.status && (!req.user || req.user.role !== 'admin')) filter.status = exactTextRegex('approved');

    const total = await Jansewa.countDocuments(filter);
    const kendras = await Jansewa.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: kendras.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: kendras
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const registerPartner = async (req, res) => {
  try {
    const data = {
      ...req.body,
      category: normalizeCategory(req.body.category),
      owner: req.user?._id,
      status: 'pending' // Force pending for new registrations
    };
    const newPartner = await Jansewa.create(data);
    res.status(201).json({ status: 'success', data: newPartner });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const updatePartnerStatus = async (req, res) => {
  try {
    const status = normalizeStatus(req.body.status);
    const partner = await Jansewa.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ status: 'fail', message: 'Partner not found' });
    }

    partner.status = status;
    partner.isVerified = status === 'approved';
    partner.category = normalizeCategory(req.body.category || partner.category);
    await partner.save();

    res.status(200).json({ status: 'success', data: partner });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const createKendra = async (req, res) => {
  try {
    const status = normalizeStatus(req.body.status, 'approved');
    const newKendra = await Jansewa.create({
      ...req.body,
      category: normalizeCategory(req.body.category),
      status,
      isVerified: status === 'approved'
    });
    res.status(201).json({ status: 'success', data: newKendra });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const getKendra = async (req, res) => {
  try {
    const kendra = await Jansewa.findById(req.params.id);
    res.status(200).json({ status: 'success', data: kendra });
  } catch (err) {
    res.status(404).json({ status: 'fail', message: 'Kendra not found' });
  }
};

const confirmRazorpayPayment = async (req, res) => {
  try {
    const {
      paymentId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      offerId,
      kendraId
    } = req.body;

    const finalPaymentId = paymentId || razorpayPaymentId;
    if (!finalPaymentId || !offerId) {
      return res.status(400).json({
        status: 'fail',
        message: 'paymentId and offerId are required'
      });
    }

    const offers = getRazorpayOffers();
    const offer = offers[offerId];
    if (!offer || !Number.isFinite(Number(offer.premiumDays)) || Number(offer.premiumDays) <= 0) {
      return res.status(400).json({ status: 'fail', message: 'Invalid Razorpay offer' });
    }

    if (!verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: finalPaymentId,
      signature: razorpaySignature
    })) {
      return res.status(400).json({ status: 'fail', message: 'Invalid Razorpay signature' });
    }

    const existingPayment = await RazorpayPayment.findOne({ paymentId: finalPaymentId });
    if (existingPayment) {
      if (existingPayment.user.toString() !== req.user.id.toString()) {
        return res.status(409).json({
          status: 'fail',
          message: 'This Razorpay payment is already linked to another account'
        });
      }
      const user = await User.findById(req.user.id);
      return res.status(200).json({
        status: 'success',
        message: 'Payment already confirmed',
        data: {
          premiumUntil: existingPayment.premiumUntil,
          isPremium: !!user?.isPremium,
          source: 'razorpay',
          premiumDays: existingPayment.premiumDays
        }
      });
    }

    const payment = await fetchRazorpayPayment(finalPaymentId);
    const expectedAmount = Number(offer.amount);
    const expectedCurrency = offer.currency || 'INR';
    const premiumDays = Number(offer.premiumDays);

    if (payment.amount !== expectedAmount || payment.currency !== expectedCurrency) {
      return res.status(400).json({ status: 'fail', message: 'Payment does not match selected offer' });
    }

    if (!['captured', 'authorized'].includes(payment.status)) {
      return res.status(400).json({ status: 'fail', message: `Payment is not successful yet: ${payment.status}` });
    }

    const user = await User.findById(req.user.id);
    const premiumUntil = calculatePremiumUntil(user.premiumUntil, premiumDays);
    const validKendraId = kendraId && mongoose.Types.ObjectId.isValid(kendraId) ? kendraId : undefined;

    user.isPremium = true;
    user.premiumUntil = premiumUntil;
    user.premiumSource = 'razorpay';
    user.lastPremiumPaymentId = finalPaymentId;
    await user.save({ validateBeforeSave: false });

    const savedPayment = await RazorpayPayment.create({
      user: req.user.id,
      kendra: validKendraId,
      offerId,
      paymentId: finalPaymentId,
      razorpayOrderId,
      razorpaySignature,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      premiumDays,
      premiumUntil,
      rawPayment: payment
    });

    res.status(200).json({
      status: 'success',
      message: 'Razorpay payment verified and premium activated',
      data: {
        payment: savedPayment,
        premiumUntil,
        isPremium: true,
        source: 'razorpay',
        premiumDays
      }
    });
  } catch (err) {
    console.error('[Razorpay] confirm failed:', err.message);
    res.status(err.statusCode || 400).json({ status: 'fail', message: err.message });
  }
};

module.exports = {
  getAllKendras,
  createKendra,
  getKendra,
  registerPartner,
  updatePartnerStatus,
  confirmRazorpayPayment
};
