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
app.get('/admin/settings', (req, res) => res.sendFile(path.join(__dirname, '../public/settings.html')));
app.get('/', (req, res) => res.redirect('/admin/login'));

// 3. AI ASSISTANT ROUTE (Personalized & Intelligent Routing)
app.post('/api/v1/ai/ask', async (req, res) => {
    try {
        const { question, userMessage, userName, userLocation, userDOB, userCategory, userQualification, history } = req.body;
        const rawInput = userMessage || question || "";
        const userQuery = rawInput.toLowerCase();

        // --- STEP 1: INTENT DETECTION ---
        const isJobRelated = userQuery.match(/(job|naukri|form|eligibility|age|qualification|salary|vacancy|bhar sakta|apply|scheme|yojana|scholarship|paisa|bolo|yes|details|options|career|ssc|upsc|railway|police|cgl|chsl)/i);

        // --- STEP 2: CALCULATE SERVER FACT (AGE) ---
        let calculatedAge = "Unknown";
        const today = new Date();

        // Format date to DD/MM/YYYY
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const formattedToday = `${day}/${month}/${year}`;

        if (userDOB) {
            const birthDate = new Date(userDOB);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            calculatedAge = age;
        }

        // --- STEP 3: CONTEXT PREPARATION ---
        let contextInstruction = "";
        let jobInfo = "";
        let kendraInfo = "";

        if (isJobRelated) {
            // Smart Search: Try to find jobs that match the user's keywords
            const keywords = userQuery.split(/\s+/).filter(w => w.length > 2);
            let searchCriteria = {};

            if (keywords.length > 0) {
                searchCriteria = {
                    $or: [
                        { title: { $regex: keywords.join('|'), $options: 'i' } },
                        { organization: { $regex: keywords.join('|'), $options: 'i' } }
                    ]
                };
            }

            const [jobs, kendras] = await Promise.all([
                Job.find(searchCriteria).sort({ _id: -1 }).limit(8),
                Jansewa.find().limit(3)
            ]);

            // Fallback to recent jobs if no match found
            let finalJobs = jobs;
            if (jobs.length === 0) {
                finalJobs = await Job.find().sort({ _id: -1 }).limit(5);
            }

            jobInfo = finalJobs.map(j => {
                const edu = j.eligibility?.education || "Check Notification";
                const age = j.eligibility?.ageLimit || `${j.eligibility?.minAge}-${j.eligibility?.maxAge}`;
                return `- JOB: ${j.title}\n  Org: ${j.organization}\n  Eligibility: ${edu}\n  Age Limit: ${age}\n  Last Date: ${j.importantDates?.applicationLastDate || 'N/A'}`;
            }).join("\n\n");

            kendraInfo = kendras.map(k => `- ${k.name} (${k.address || 'Local Area'})`).join("\n");

            contextInstruction = `USER IS ASKING ABOUT JOBS/ELIGIBILITY.
            1. Use the "LIVE DATA" provided below to answer.
            2. STRICT FACT: Today's Date is ${formattedToday} (DD/MM/YYYY). User DOB is ${userDOB}. User is exactly ${calculatedAge} years old.
            3. Personalized for ${userQualification} and ${userCategory} category.
            4. Use Category Relaxation: OBC (+3 years), SC/ST (+5 years).
            5. Don't be robotic. Be helpful and direct like Gemini. Answer the specific question first.`;
        } else {
            contextInstruction = `USER IS MAKING SMALL TALK OR GENERAL QUERY.
            1. Be natural, brief, and friendly.
            2. Answer the user's question directly.
            3. Don't be robotic or use scripted introductions.`;
        }

        const systemInstruction = aiPrompts.ASSISTANT_SYSTEM_PROMPT(userName, userLocation, userDOB, userCategory, userQualification, jobInfo, kendraInfo);

        const messages = [
            { role: 'system', content: `${systemInstruction}\n\nCURRENT CONTEXT:\n${contextInstruction}` },
            ...(history || []),
            { role: 'user', content: rawInput }
        ];

        const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let runpodUrl = (runpodSetting && runpodSetting.value) || constants.DEFAULT_RUNPOD_URL;

        if (runpodUrl && !runpodUrl.includes('/api/chat')) {
            runpodUrl = runpodUrl.replace(/\/$/, '') + '/api/chat';
        }

        console.log(`🤖 AI Request: ${rawInput.substring(0, 30)}...`);

        const aiResponse = await axios.post(runpodUrl, {
            model: constants.AI_MODEL_NAME,
            messages: messages,
            stream: false,
            options: { temperature: 0.5 }
        }, { timeout: 60000 });

        if (!aiResponse.data || !aiResponse.data.message) {
            throw new Error("Invalid response from AI model");
        }

        const fullAnswer = aiResponse.data.message.content || "";
        let message = "";
        let calculation = "";

        // --- STEP 4: EXTRACTION LOGIC ---
        const hiddenMathMatch = fullAnswer.match(/<HIDDEN_MATH>([\s\S]*?)<\/HIDDEN_MATH>/i);
        const userMessageMatch = fullAnswer.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
        const oldThinkMatch = fullAnswer.match(/<(?:think|CALC)>([\s\S]*?)<\/(?:think|CALC)>/i);

        calculation = (hiddenMathMatch ? hiddenMathMatch[1] : (oldThinkMatch ? oldThinkMatch[1] : "")).trim();

        if (userMessageMatch) {
            message = userMessageMatch[1].trim();
        } else {
            // Clean tags globally if user_message tag is missing
            message = fullAnswer.replace(/<(HIDDEN_MATH|USER_MESSAGE|think|CALC)>[\s\S]*?<\/\1>/gi, '').trim();
            // If message is still empty, use full answer
            if (!message) message = fullAnswer.trim();
        }

        res.json({
            success: true,
            message: message || "Bhai, kuch error lag raha hai. Dobara bolo?",
            calculation: calculation,
            answer: fullAnswer
        });

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(200).json({
            success: false,
            message: "Bhai, server thoda slow hai. Ek baar check karo net ya thodi der me try karo.",
            answer: ""
        });
    }
});

module.exports = app;
