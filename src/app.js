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


// Feature-Based Routes
const authRoutes = require('./features/auth/authRoutes');
const jansewaRoutes = require('./features/jansewa/jansewaRoutes');
const jobRoutes = require('./features/jobs/jobRoutes');
const settingsRoutes = require('./features/settings/settingsRoutes');

const app = express();

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

// Serve Static Files (Web Admin)
app.use(express.static(path.join(__dirname, '../public')));

// 2. ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/jansewa', jansewaRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/settings', settingsRoutes);

// Web Admin Pages
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});
app.get('/admin/jansewa', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/jansewa.html'));
});
app.get('/admin/jobs', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/jobs.html'));
});
app.get('/admin/settings', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/settings.html'));
});
app.get('/', (req, res) => res.redirect('/admin/login'));

// 3. AI ASSISTANT ROUTE (Connected to RunPod)
app.post('/api/v1/ai/ask', async (req, res) => {
    try {
        const { question } = req.body;

        // 1. Database se Latest Jobs uthana
        const latestJobs = await Job.find().sort({ _id: -1 }).limit(5);
        const jobInfo = latestJobs.map(j => `- ${j.title} in ${j.location}`).join("\n");

        // 2. RunPod AI (Ollama) ko Request bhejna
        const runpodUrl = "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

        const aiResponse = await axios.post(runpodUrl, {
            model: "onc-ai",
            prompt: `Database Data:\n${jobInfo}\n\nUser Question: ${question}\n\nAssistant:`,
            stream: false
        });

        // 3. Jawab wapas bhej dena
        res.json({
            success: true,
            answer: aiResponse.data.response
        });

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({
            success: false,
            answer: "Bhai, AI abhi busy hai, thodi der mein try karna!"
        });
    }
});

module.exports = app;

