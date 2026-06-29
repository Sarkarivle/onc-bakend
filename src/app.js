const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const axios = require('axios');
const Job = require('./features/jobs/jobModel');
const Jansewa = require('./features/jansewa/jansewaModel');
const Settings = require('./features/settings/settingsModel');
const Feedback = require('./features/feedback/feedbackModel');
const Chat = require('./features/chat/chatModel');
const AIService = require('./features/ai/aiService');
const constants = require('./config/constants');


// Feature-Based Routes
const authRoutes = require('./features/auth/authRoutes');
const jansewaRoutes = require('./features/jansewa/jansewaRoutes');
const jobRoutes = require('./features/jobs/jobRoutes');
const settingsRoutes = require('./features/settings/settingsRoutes');

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

// AI Feedback Route (Learning System)
app.post('/api/v1/ai/feedback', async (req, res) => {
    try {
        const { userMessage, aiResponse, rating, userName, userLocation } = req.body;

        await Feedback.create({
            userMessage,
            aiResponse,
            rating,
            userName,
            userLocation
        });

        res.json({ success: true, message: "Feedback saved for learning" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin Correction Route (The "Gold" Standard Learning)
app.post('/api/v1/ai/correct', async (req, res) => {
    try {
        const { originalQuestion, correctedResponse, badResponse, category } = req.body;

        await Correction.create({
            originalQuestion,
            correctedResponse,
            badResponse,
            category
        });

        res.json({ success: true, message: "AI has learned the correct answer!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get Unique Chat Sessions for a user
app.get('/api/v1/ai/sessions/:userName', async (req, res) => {
    try {
        const sessions = await Chat.aggregate([
            { $match: { userName: req.params.userName } },
            { $sort: { timestamp: 1 } },
            {
                $group: {
                    _id: "$sessionId",
                    firstMessage: { $first: "$content" },
                    timestamp: { $first: "$timestamp" }
                }
            },
            { $sort: { timestamp: -1 } }
        ]);
        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get Chat history for a specific session
app.get('/api/v1/ai/history/:userName/:sessionId', async (req, res) => {
    try {
        const history = await Chat.find({
            userName: req.params.userName,
            sessionId: req.params.sessionId
        }).sort({ timestamp: 1 });
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Purana route backup ke liye (Optional, but let's keep the new session logic clean)
app.get('/api/v1/ai/history/:userName', async (req, res) => {
    try {
        const history = await Chat.find({ userName: req.params.userName })
            .sort({ timestamp: 1 })
            .limit(50);
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. AI ASSISTANT ROUTE (Modular & Service-Oriented)
app.post('/api/v1/ai/ask', async (req, res) => {
    try {
        const response = await AIService.processRequest(req.body);
        res.json(response);
    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(200).json({
            success: false,
            message: "Bhai, server thoda slow hai. Ek baar check karo net ya thodi der me try karo.",
            answer: ""
        });
    }
});

// Streaming AI Route
app.post('/api/v1/ai/ask-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        await AIService.processRequestStream(req.body, (chunk) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        });
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error("Streaming Route Error:", error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

module.exports = app;
