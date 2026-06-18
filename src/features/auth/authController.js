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

    const user = await User.findOne({ phone }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({ status: 'fail', message: 'Incorrect phone or password' });
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
