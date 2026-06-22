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
const aiPrompts = require('./features/ai/aiPrompts');


// Feature-Based Routes
const authRoutes = require('./features/auth/authRoutes');
const jansewaRoutes = require('./features/jansewa/jansewaRoutes');
const jobRoutes = require('./features/jobs/jobRoutes');
const settingsRoutes = require('./features/settings/settingsRoutes');

const app = express();
console.log('##############################################');
console.log('🚀 ONC-BACKEND STARTING: VERSION 5.0 (CRASH-PROOF)');
console.log('##############################################');

console.log('🚀 [ONC-BACKEND] Naya Crash-Proof Code Load Ho Raha Hai... v2');

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

// 3. AI ASSISTANT ROUTE (Personalized & Data-Rich)
app.post('/api/v1/ai/ask', async (req, res) => {
    try {
        const { question, userName, userLocation } = req.body;

        // 1. Database se Jobs aur Jansewa ka data nikalna
        const [latestJobs, kendras] = await Promise.all([
            Job.find().sort({ _id: -1 }).limit(5),
            Jansewa.find().limit(3)
        ]);

        const jobInfo = latestJobs.length > 0
            ? latestJobs.map(j => `- ${j.title} in ${j.location} (Total Vacancy: ${j.totalVacancy || 'Not Specified'})`).join("\n")
            : "Abhi koi nayi job update nahi hai.";

        const kendraInfo = kendras.length > 0
            ? kendras.map(k => `- ${k.name} (${k.address})`).join("\n")
            : "Jansewa kendra ki jankari jald hi update hogi.";

        // RUNPOD AI (Ollama) Request
        const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let runpodUrl = (runpodSetting && runpodSetting.value) || "https://nqzncrap1jzhbr-11434.proxy.runpod.net/api/generate";

        // Auto-fix URL: Ensure it ends with /api/generate
        if (runpodUrl && !runpodUrl.includes('/api/generate')) {
            runpodUrl = runpodUrl.replace(/\/$/, '') + '/api/generate';
        }

        console.log(`🤖 AI Request to: ${runpodUrl}`);

        const systemInstruction = aiPrompts.ASSISTANT_SYSTEM_PROMPT(userName, userLocation, jobInfo, kendraInfo);

        const aiResponse = await axios.post(runpodUrl, {
            model: "onc-ai",
            prompt: `${systemInstruction}\n\nUser Question: ${question}\n\nAssistant Jawab:`,
            stream: false,
            options: {
                temperature: 0.5,
                stop: ["User:", "Assistant:", "Question:"]
            }
        }, { timeout: 30000 }); // 30s timeout for AI response

        res.json({
            success: true,
            answer: aiResponse.data.response
        });

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            answer: "Bhai, AI abhi busy hai, thodi der mein try karna!"
        });
    }
});

module.exports = app;

