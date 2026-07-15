const mongoose = require('mongoose');

const razorpayPaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kendra: { type: mongoose.Schema.Types.ObjectId, ref: 'Jansewa' },
  offerId: { type: String, required: true },
  paymentId: { type: String, required: true, unique: true },
  razorpayOrderId: { type: String },
  razorpaySignature: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, required: true },
  premiumDays: { type: Number, required: true },
  premiumUntil: { type: Date, required: true },
  rawPayment: { type: Object },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RazorpayPayment', razorpayPaymentSchema);
