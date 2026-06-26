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

// 3. AI ASSISTANT ROUTE (Personalized & Intelligent Routing)
app.post('/api/v1/ai/ask', async (req, res) => {
    try {
        const { question, userMessage, userName, userLocation, userDOB, userCategory, userQualification, history } = req.body;
        const userQuery = (userMessage || question || "").toLowerCase();

        // --- STEP 1: INTENT DETECTION (Math/Job vs Normal Talk) ---
        const isJobRelated = userQuery.match(/(job|naukri|form|eligibility|age|qualification|salary|vacancy|bhar sakta|apply|scheme|yojana|scholarship|paisa|bolo|yes|details)/i);

        // --- STEP 2: CALCULATE SERVER FACT (AGE) ---
        let calculatedAge = "Unknown";
        if (userDOB) {
            const birthDate = new Date(userDOB);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            calculatedAge = age;
        }

        // --- STEP 3: CONTEXT PREPARATION ---
        let contextInstruction = "";
        let jobInfo = "No recent updates.";
        let kendraInfo = "";

        if (isJobRelated) {
            const [jobs, kendras] = await Promise.all([
                Job.find().sort({ _id: -1 }).limit(5),
                Jansewa.find().limit(3)
            ]);
            jobInfo = jobs.map(j => `- ${j.title} (Age: ${j.ageLimit}, Edu: ${j.qualification})`).join("\n");
            kendraInfo = kendras.map(k => `- ${k.name}`).join("\n");

            contextInstruction = `USER IS ASKING ABOUT JOBS/ELIGIBILITY.
            1. Use Lora_v1 training for facts.
            2. MANDATORY: Put all math/reasoning in <think> tags.
            3. STRICT FACT: User is exactly ${calculatedAge} years old.
            4. Suggest jobs only if user is eligible (${userQualification}).`;
        } else {
            contextInstruction = `USER IS MAKING SMALL TALK.
            1. Be a friendly brother.
            2. Don't show job lists or math unless asked.
            3. Just reply to their message normally.`;
        }

        const systemInstruction = aiPrompts.ASSISTANT_SYSTEM_PROMPT(userName, userLocation, userDOB, userCategory, userQualification, jobInfo, kendraInfo);

        // Build Messages
        const messages = [
            { role: 'system', content: `${systemInstruction}\n\nCURRENT CONTEXT:\n${contextInstruction}` },
            ...(history || []),
            { role: 'user', content: userMessage || question }
        ];

        // API Call
        const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let runpodUrl = (runpodSetting && runpodSetting.value) || constants.DEFAULT_RUNPOD_URL;

        if (runpodUrl && !runpodUrl.includes('/api/chat')) {
            runpodUrl = runpodUrl.replace(/\/$/, '') + '/api/chat';
        }

        const aiResponse = await axios.post(runpodUrl, {
            model: constants.AI_MODEL_NAME,
            messages: messages,
            stream: false,
            options: { temperature: 0.4 }
        }, { timeout: 60000 });

        const fullAnswer = aiResponse.data.message.content;
        let message = fullAnswer;
        let calculation = "";

        // --- STEP 4: POST-PROCESSING (CLEANUP) ---
        const thinkMatch = fullAnswer.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
            calculation = thinkMatch[1].trim();
            message = fullAnswer.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
        }

        res.json({
            success: true,
            message: message,
            calculation: calculation,
            answer: fullAnswer
        });

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ success: false, answer: "Bhai, server error aa raha hai. Thodi der me try karein." });
    }
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

