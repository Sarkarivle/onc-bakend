const express = require('express');
const Feedback = require('../feedback/feedbackModel');
const Chat = require('../chat/chatModel');
const Correction = require('./correctionModel');
const AIOrchestrator = require('./orchestrator/aiOrchestrator');

const PlannerController = require('./plannerController');
const VoiceController = require('./voiceController');

const router = express.Router();
const User = require('../auth/userModel');
const DashboardTool = require('./tools/dashboardTool');

// --- NEW SHADOW DASHBOARD ROUTES ---
router.get('/planner-logs', PlannerController.getLogs);
router.patch('/planner-logs/:id', PlannerController.correctLog);
router.get('/planner-logs/export', PlannerController.exportData);

const { protect } = require('../../middlewares/authMiddleware');

// ... existing code ...

// API to get real-time stats for the Hero Card
router.get('/dashboard-stats/:userName', async (req, res) => {
    try {
        // Try to find by name (legacy) or just use authenticated user if token provided
        let user;

        // If there's an auth header, use the protect logic manually or via middleware
        // For now, let's keep the name lookup but make it more robust
        user = await User.findOne({ name: { $regex: new RegExp(`^${req.params.userName}$`, 'i') } }).lean();

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const stats = await DashboardTool.getStats(user);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ... existing feedback and history routes ...
router.post('/feedback', async (req, res) => {
    try {
        const { userMessage, aiResponse, rating, userName, userLocation } = req.body;
        await Feedback.create({ userMessage, aiResponse, rating, userName, userLocation });
        res.json({ success: true, message: "Feedback saved for learning" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/correct', async (req, res) => {
    try {
        const { originalQuestion, correctedResponse, badResponse, category } = req.body;
        await Correction.create({ originalQuestion, correctedResponse, badResponse, category });
        res.json({ success: true, message: "AI has learned the correct answer!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/sessions/:userName', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

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
            { $sort: { timestamp: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);
        res.json({ success: true, page, sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/history/:userName/:sessionId', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const history = await Chat.find({
            userName: req.params.userName,
            sessionId: req.params.sessionId
        })
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(limit);

        res.json({ success: true, page, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/history/:userName', async (req, res) => {
    try {
        const history = await Chat.find({ userName: req.params.userName })
            .sort({ timestamp: 1 })
            .limit(50);
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// AI assistant route.
router.post('/voice-stream', VoiceController.handleVoiceStream);

router.post('/ask', async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ success: false, requestId: req.requestId, message: "Invalid request body" });
        }
        const response = await AIOrchestrator.processRequest({ ...req.body, requestId: req.requestId });
        res.json(response);
    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(200).json({
            success: false,
            requestId: req.requestId,
            message: "Bhai, server thoda slow hai. Ek baar check karo net ya thodi der me try karo.",
            answer: ""
        });
    }
});

// REDESIGNED Streaming AI route.
router.post('/ask-stream', async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ success: false, requestId: req.requestId, message: "Invalid request body" });
        }
        await AIOrchestrator.processRequestStream({ ...req.body, requestId: req.requestId }, res);
    } catch (error) {
        console.error("Streaming Route Error:", error);
        res.end();
    }
});

module.exports = router;
