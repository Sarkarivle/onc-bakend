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
const constants = require('./config/constants');


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

// Database Sync: Purane links ko auto-update karna
(async () => {
    try {
        // Database Sync: Purane links aur models ko auto-update karna
        const oldIds = ['d01tlzhc7vd8uq', 'fnw56unrazffyl', 'wumkvy5y9epghs', 'nqzncrap1jzhbr', '2iikutwcien56l'];
        const setting = await Settings.findOne({ key: 'RUNPOD_URL' });

        // Auto-update URL if old
        if (setting && oldIds.some(id => setting.value.includes(id))) {
            console.log('🔄 Old RunPod link detected in DB, updating to latest...');
            setting.value = constants.DEFAULT_RUNPOD_URL;
            await setting.save();
        }

        // Ensure model name is correct (llama3 -> llama3:8b)
        if (constants.AI_MODEL_NAME === 'llama3:8b') {
            // We can add logic here if we were storing AI_MODEL_NAME in DB
        }
    } catch (err) { console.error('DB Sync Error:', err.message); }
})();

// Web Admin Pages
app.get('/admin/config.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`window.ONC_CONFIG = ${JSON.stringify(constants)};`);
});

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
        const { question, userMessage, userName, userLocation, userDOB, userCategory, userQualification, history } = req.body;

        // Support both 'question' and 'userMessage' for flexibility
        const userQuery = userMessage || question;

        if (!userQuery) {
            return res.status(400).json({ success: false, error: "Question is required" });
        }

        // 1. Database se Jobs aur Jansewa ka data nikalna
        const [latestJobs, kendras] = await Promise.all([
            Job.find().sort({ _id: -1 }).limit(5),
            Jansewa.find().limit(3)
        ]);

        const jobInfo = latestJobs.length > 0
            ? latestJobs.map(j => `JOB: ${j.title}
  - Location: ${j.location}
  - Vacancy: ${j.totalVacancy || 'N/A'}
  - Age Limit: ${j.ageLimit || '21-40'} years
  - Qualification: ${j.qualification || 'Graduate'}
  - Last Date: ${j.lastDate || 'Check Notification'}`).join("\n\n")
            : "Abhi koi nayi job update nahi hai.";

        const kendraInfo = kendras.length > 0
            ? kendras.map(k => `- ${k.name} (${k.address})`).join("\n")
            : "Jansewa kendra ki jankari jald hi update hogi.";

        // RUNPOD AI (Ollama) Request
        const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let runpodUrl = (runpodSetting && runpodSetting.value) || constants.DEFAULT_RUNPOD_URL;

        // Auto-fix URL: Ensure it ends with /api/chat
        if (runpodUrl && !runpodUrl.includes('/api/chat')) {
            if (runpodUrl.includes('/api/generate')) {
                runpodUrl = runpodUrl.replace('/api/generate', '/api/chat');
            } else {
                runpodUrl = runpodUrl.replace(/\/$/, '') + '/api/chat';
            }
        }

        console.log(`🤖 AI Chat Request to: ${runpodUrl} | Model: ${constants.AI_MODEL_NAME}`);

        const systemInstruction = aiPrompts.ASSISTANT_SYSTEM_PROMPT(
            userName,
            userLocation,
            userDOB,
            userCategory,
            userQualification,
            jobInfo,
            kendraInfo
        );

        // Calculate Age Server-side to avoid AI Math errors
        let calculatedAge = "Nahi pata";
        if (userDOB) {
            const birthDate = new Date(userDOB);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            calculatedAge = age;
        }

        // Construct messages for /api/chat
        const messages = [
            { role: 'system', content: `${systemInstruction}\n\nSTRICT FACT: User ki current age EXACTLY ${calculatedAge} saal hai. Ispe koi sawal mat karna.` },
            ...(history || []),
            { role: 'user', content: question }
        ];

        const aiResponse = await axios.post(runpodUrl, {
            model: constants.AI_MODEL_NAME,
            messages: messages,
            stream: false,
            options: {
                temperature: 0.5
            }
        }, { timeout: 60000 }); // 60s timeout for AI response

        const fullAnswer = aiResponse.data.message.content;
        let message = fullAnswer;
        let calculation = "";

        // Support both <think> (DeepSeek style) and [CALC] (our custom style)
        const thinkMatch = fullAnswer.match(/<(?:think|CALC)>([\s\S]*?)<\/(?:think|CALC)>/i);
        const calcMatch = fullAnswer.match(/\[CALC\]([\s\S]*?)\[\/CALC\]/i);

        const logicMatch = thinkMatch || calcMatch;

        if (logicMatch) {
            calculation = logicMatch[1].trim();
            // Remove the logic block from the main message
            message = fullAnswer.replace(/<(?:think|CALC)>[\s\S]*?<\/(?:think|CALC)>/i, '')
                                .replace(/\[CALC\][\s\S]*?\[\/CALC\]/i, '')
                                .trim();
        }

        res.json({
            success: true,
            message: message,
            calculation: calculation,
            answer: fullAnswer
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

