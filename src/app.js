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
const Correction = require('./features/ai/correctionModel');
const SearchService = require('./features/ai/searchService');
const IntentDetector = require('./features/ai/intentDetector');
const PromptComposer = require('./features/ai/promptComposer');
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

// 3. AI ASSISTANT ROUTE (Personalized & Intelligent Routing)
app.post('/api/v1/ai/ask', async (req, res) => {
    try {
        const { question, userMessage, userName, userLocation, userDOB, userCategory, userQualification, history, sessionId } = req.body;
        const rawInput = userMessage || question || "";

        // Save User Message to History with SessionId
        if (rawInput && userName && sessionId) {
            await Chat.create({ userName, sessionId, role: 'user', content: rawInput });
        }

        // --- STEP 1: INTENT DETECTION & TONE ANALYSIS ---
        const rawInput = userMessage || question || "";
        const userQuery = rawInput.toLowerCase();
        const intents = IntentDetector.detect(rawInput);

        // --- STEP 2: FETCH USER LEARNINGS ---
        const userLearnings = await Feedback.find({ userName }).sort({ timestamp: -1 }).limit(5);
        const insights = userLearnings.map(l => l.rating === 'up' ? `LIKED: ${l.aiResponse.substring(0,20)}` : `DISLIKED: ${l.aiResponse.substring(0,20)}`).join(' | ');

        // --- STEP 3: CALCULATE SERVER FACT (AGE & DATE) ---
        let calculatedAge = "Unknown";
        const indiaDate = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });
        const formattedToday = indiaDate.split(',')[0];
        const currentYear = formattedToday.split('/')[2];

        if (userDOB) {
            const todayKolkata = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            const birthDate = new Date(userDOB);
            let age = todayKolkata.getFullYear() - birthDate.getFullYear();
            const m = todayKolkata.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && todayKolkata.getDate() < birthDate.getDate())) age--;
            calculatedAge = age;
        }

        // --- STEP 4: CONTEXT PREPARATION (Modular) ---
        let jobInfo = "";
        let kendraInfo = "";
        let searchResults = null;

        if (intents.includes('GOVT_JOB')) {
            const keywords = userQuery.split(/\s+/).filter(w => w.length > 2);
            let searchCriteria = { isActive: true };

            if (keywords.length > 0) {
                searchCriteria.$or = [
                    { title: { $regex: keywords.join('|'), $options: 'i' } },
                    { organization: { $regex: keywords.join('|'), $options: 'i' } }
                ];
            }

            const [jobs, kendras] = await Promise.all([
                Job.find(searchCriteria).sort({ _id: -1 }).limit(8),
                Jansewa.find().limit(3)
            ]);

            if (jobs.length === 0) {
                const [searchKey, searchCx] = await Promise.all([
                    Settings.findOne({ key: 'GOOGLE_SEARCH_API_KEY' }),
                    Settings.findOne({ key: 'GOOGLE_SEARCH_CX' })
                ]);
                searchResults = await SearchService.search(rawInput, searchKey?.value, searchCx?.value);
            }

            jobInfo = jobs.map(j => `- JOB: ${j.title} | Org: ${j.organization} | Age: ${j.eligibility?.ageLimit || "18-40"}`).join("\n");
            kendraInfo = kendras.map(k => `${k.name} (${k.address || 'Bareilly'})`).join(", ");
        }

        const userData = { name: userName, loc: userLocation, dob: userDOB, cat: userCategory, qual: userQualification, insights };
        const liveData = { jobs: jobInfo, kendras: kendraInfo, web: searchResults ? JSON.stringify(searchResults) : "" };

        const systemInstruction = PromptComposer.build(intents, userData, liveData, formattedToday, currentYear);

        const messages = [
            { role: 'system', content: systemInstruction },
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

        // Extract suggestions for database storage
        let suggestions = [];
        const suggestMatch = fullAnswer.match(/\[SUGGESTIONS\s*:\s*(.*?)\]/i);
        if (suggestMatch) {
            suggestions = suggestMatch[1].split(',').map(s => s.trim());
        }

        // Save AI Response to History with SessionId
        if (message && userName && sessionId) {
            await Chat.create({
                userName,
                sessionId,
                role: 'assistant',
                content: message,
                calculation: calculation,
                suggestions: suggestions
            });
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
