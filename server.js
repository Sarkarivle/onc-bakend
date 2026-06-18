const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// 1. GLOBAL MIDDLEWARES (Security First)
app.use(helmet()); // Set security HTTP headers
app.use(morgan('dev')); // Development logging

// Rate Limiting: Prevent Brute Force Attacks
const limiter = rateLimit({
  max: 100, // limit each IP to 100 requests per windowMs
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

app.use(express.json({ limit: '10kb' })); // Body parser, reading data from body into req.body (limited to 10kb to prevent DDoS)
app.use(mongoSanitize()); // Data sanitization against NoSQL query injection
app.use(xss()); // Data sanitization against XSS
app.use(cors()); // Enable CORS for authorized origins only (configure properly for production)

// 2. DATABASE CONNECTION
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";
mongoose.connect(mongoURI)
  .then(() => console.log('✅ Ultra Secure DB Connection Established'))
  .catch(err => console.error('❌ DB Connection Error:', err));

// 3. MODELS (User & Admin Schema)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, // Password hidden by default
  role: { type: String, enum: ['user', 'admin', 'expert'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to check password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);

// 4. AUTHENTICATION LOGIC (JWT)
const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super-ultra-secret-key-donot-share', {
    expiresIn: process.env.JWT_EXPIRES_IN || '90d'
  });
};

// 5. ROUTES
// --- Admin/User Registration (Signup) ---
app.post('/api/v1/auth/signup', async (req, res) => {
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
});

// --- Login (Admin & User) ---
app.post('/api/v1/auth/login', async (req, res) => {
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
});

// --- Middleware to Protect Routes (Check if logged in) ---
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) throw new Error('You are not logged in!');

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-ultra-secret-key-donot-share');
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) throw new Error('User no longer exists');

    req.user = currentUser;
    next();
  } catch (err) {
    res.status(401).json({ status: 'fail', message: err.message });
  }
};

// --- Middleware for Role Restrictions ---
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

// --- Secure Route (Example: Only Admin can see full logs) ---
app.get('/api/v1/admin/stats', protect, restrictTo('admin'), (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { stats: 'Ultra secure admin data reached!' }
  });
});

// 6. SERVER START
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Ultra Secure Server active on port ${PORT}`);
});
