const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const constants = require('./config/constants');


// Feature-Based Routes
const authRoutes = require('./features/auth/authRoutes');
const jansewaRoutes = require('./features/jansewa/jansewaRoutes');
const jobRoutes = require('./features/jobs/jobRoutes');
const settingsRoutes = require('./features/settings/settingsRoutes');
const aiRoutes = require('./features/ai/aiRoutes');

const app = express();
console.log('##############################################');
console.log('🚀 ONC-BACKEND STARTING: VERSION 6.0 (STABLE)');
console.log('##############################################');

// 1. GLOBAL MIDDLEWARES
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests, try again in an hour'
});
app.use('/api', limiter);

app.use(express.json({ limit: '100kb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(cors());

// Serve Static Files
app.use(express.static(path.join(__dirname, '../public')));

// 2. ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/jansewa', jansewaRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/ai', aiRoutes);

// Web Admin Pages
app.get('/admin/config.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`window.ONC_CONFIG = ${JSON.stringify(constants)};`);
});

app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/admin/jansewa', (req, res) => res.sendFile(path.join(__dirname, '../public/jansewa.html')));
app.get('/admin/jobs', (req, res) => res.sendFile(path.join(__dirname, '../public/jobs.html')));
app.get('/admin/edit-job', (req, res) => res.sendFile(path.join(__dirname, '../public/edit-job.html')));
app.get('/admin/settings', (req, res) => res.sendFile(path.join(__dirname, '../public/settings.html')));
app.get('/', (req, res) => res.redirect('/admin/login'));

module.exports = app;
