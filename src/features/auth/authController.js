const jwt = require('jsonwebtoken');
const User = require('./userModel');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super-ultra-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '90d'
  });
};

exports.signup = async (req, res) => {
  try {
    const newUser = await User.create({
      name: req.body.name,
      phone: req.body.phone,
      password: req.body.password,
      role: req.body.role || 'user'
    });

    const token = signToken(newUser._id);
    res.status(201).json({
      status: 'success',
      token,
      data: { user: newUser }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) throw new Error('Please provide phone and password');

    let user = await User.findOne({ phone }).select('+password');

    if (!user) {
      // Auto-Signup if user doesn't exist
      user = await User.create({
        name: 'User ' + phone.slice(-4),
        phone: phone,
        password: password
      });
      // Need to re-fetch to exclude password and include other fields if necessary,
      // but User.create returns the object.
    } else {
      // Existing user: check password
      if (!(await user.correctPassword(password, user.password))) {
        return res.status(401).json({ status: 'fail', message: 'Incorrect password for this mobile number' });
      }
    }

    const token = signToken(user._id);
    res.status(200).json({
      status: 'success',
      token,
      role: user.role,
      name: user.name
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    // 1. Filter out fields that are not allowed to be updated
    const filteredBody = { ...req.body };
    ['password', 'role', 'phone'].forEach(el => delete filteredBody[el]);

    // 2. Update user document
    const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
