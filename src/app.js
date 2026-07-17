const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const { randomUUID } = require('crypto');
const constants = require('./config/constants');


// Feature-Based Routes
const authRoutes = require('./features/auth/authRoutes');
const jansewaRoutes = require('./features/jansewa/jansewaRoutes');
const jobRoutes = require('./features/jobs/jobRoutes');
const settingsRoutes = require('./features/settings/settingsRoutes');
const aiRoutes = require('./features/ai/aiRoutes');
const feedRoutes = require('./features/feed/feedRoutes');
const chatRoutes = require('./features/chat/chatRoutes');
const sourceRoutes = require('./features/sources/sourceRoutes');
const adviceReviewRoutes = require('./features/eligibility/adviceReviewRoutes');

const app = express();
console.log('##############################################');
console.log('🚀 JOBO-BACKEND STARTING: VERSION 6.0 (STABLE)');
console.log('##############################################');

// 1. GLOBAL MIDDLEWARES
app.use(helmet({ contentSecurityPolicy: false }));
app.set('trust proxy', 1);

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

morgan.token('request-id', req => req.requestId);
app.use(morgan(':method :url :status :response-time ms requestId=:request-id'));

const dbStateName = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
};

app.get('/health', (req, res) => {
  const dbState = dbStateName();
  res.status(dbState === 'connected' ? 200 : 503).json({
    status: dbState === 'connected' ? 'ok' : 'degraded',
    database: dbState,
  });
});

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, try again in an hour' }
});
app.use('/api', limiter);

app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    status: 'error',
    message: 'Database unavailable',
    database: dbStateName(),
  });
});

const aiLimiter = rateLimit({
  max: Number(process.env.AI_RATE_LIMIT_PER_HOUR || 40),
  windowMs: 60 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'AI request limit reached. Please try again later.' }
});
app.use('/api/v1/ai', aiLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(mongoSanitize());
app.use(xss());

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  }
}));

// Serve Static Files
app.use(express.static(path.join(__dirname, '../public')));

// 2. ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/jansewa', jansewaRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/feed', feedRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/sources', sourceRoutes);
app.use('/api/v1/admin/ai-advice', adviceReviewRoutes);

// Web Admin Pages
app.get('/admin/config.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`window.JOBO_CONFIG = ${JSON.stringify(constants)};`);
});

app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/admin/planner-logs', (req, res) => res.sendFile(path.join(__dirname, '../public/planner-logs.html')));
app.get('/admin/ai-advice', (req, res) => res.sendFile(path.join(__dirname, '../public/ai-advice.html')));
app.get('/admin/jansewa', (req, res) => res.sendFile(path.join(__dirname, '../public/jansewa.html')));
app.get('/admin/jobs', (req, res) => res.sendFile(path.join(__dirname, '../public/jobs.html')));
app.get('/admin/edit-job', (req, res) => res.sendFile(path.join(__dirname, '../public/edit-job.html')));
app.get('/admin/settings', (req, res) => res.sendFile(path.join(__dirname, '../public/settings.html')));
app.get('/', (req, res) => res.redirect('/admin/login'));

app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    level: 'ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    path: req.originalUrl,
    message: err.message
  }));
  res.status(err.statusCode || 500).json({
    success: false,
    requestId: req.requestId,
    message: 'Internal server error'
  });
});

module.exports = app;
