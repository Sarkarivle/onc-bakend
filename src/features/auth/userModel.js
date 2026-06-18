const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin', 'expert'], default: 'user' },
  isVerified: { type: Boolean, default: false },

  // Personalization Fields
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  category: { type: String, enum: ['General', 'OBC', 'SC', 'ST', 'EWS'], default: 'General' },
  dob: { type: Date }, // Date of Birth for age calculation
  education: { type: String }, // e.g. 10th, 12th, Graduate
  height: { type: Number }, // in cm
  weight: { type: Number }, // in kg
  certificates: [{ type: String }], // e.g. ['CCC', 'NCC-B', 'O-Level']
  domicileState: { type: String, default: 'Uttar Pradesh' },
  city: { type: String },

  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model('User', userSchema);
