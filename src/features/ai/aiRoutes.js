const express = require('express');
const jwt = require('jsonwebtoken');
const Feedback = require('../feedback/feedbackModel');
const Chat = require('../chat/chatModel');
const Correction = require('./correctionModel');
const AIOrchestrator = require('./orchestrator/aiOrchestrator');

const PlannerController = require('./plannerController');
const VoiceController = require('./voiceController');

const router = express.Router();
const User = require('../auth/userModel');
const DashboardTool = require('./tools/dashboardTool');
const { protect, restrictTo } = require('../../middlewares/authMiddleware');
const JWT_SECRET = require('../../config/jwt');

const adminOnly = [protect, restrictTo('admin')];

const getRequestUserName = (req) => req.user?.name || 'User';
const getRequestedUserName = (req) => {
    if (req.user?.role === 'admin' || req.user?.role === 'expert') {
        return req.params.userName || req.user.name;
    }
    return req.user?.name;
};

const buildAiInput = (req) => ({
    ...req.body,
    userName: req.user?.name || 'Guest',
    userId: req.user?._id?.toString(),
    authRole: req.user?.role,
    isGuest: !req.user,
    requestId: req.requestId
});

const optionalProtect = async (req, res, next) => {
    try {
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) return next();
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUser = await User.findById(decoded.id);
        if (currentUser) req.user = currentUser;
    } catch (_) {
        // Guest AI should still work; protected history/admin routes remain strict.
    }
    next();
};

// --- NEW SHADOW DASHBOARD ROUTES ---
router.get('/planner-logs', adminOnly, PlannerController.getLogs);
router.patch('/planner-logs/:id', adminOnly, PlannerController.correctLog);
router.get('/planner-logs/export', adminOnly, PlannerController.exportData);

// Public/guest-safe assistant routes. Auth is used when present, but not required for basic chat.
router.post('/voice-stream', optionalProtect, VoiceController.handleVoiceStream);

router.post('/ask', optionalProtect, async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ success: false, requestId: req.requestId, message: "Invalid request body" });
        }
        const response = await AIOrchestrator.processRequest(buildAiInput(req));
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

router.post('/ask-stream', optionalProtect, async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ success: false, requestId: req.requestId, message: "Invalid request body" });
        }
        await AIOrchestrator.processRequestStream(buildAiInput(req), res);
    } catch (error) {
        console.error("Streaming Route Error:", error);
        res.end();
    }
});

router.use(protect);

// ... existing code ...

// --- DASHBOARD ROUTE ---
router.get('/dashboard-stats', async (req, res) => {
    try {
        // Use the authenticated user from the protect middleware
        const stats = await DashboardTool.getStats(req.user);
        res.json(stats);
    } catch (error) {
        console.error("Dashboard Stats Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Legacy route for backward compatibility (optional but recommended to keep for a bit)
router.get('/dashboard-stats/:userName', async (req, res) => {
    try {
        const targetName = getRequestedUserName(req);
        if (!targetName) return res.status(403).json({ success: false, message: "Forbidden" });
        const user = await User.findOne({ name: targetName }).lean();
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
        const { userMessage, aiResponse, rating, userLocation } = req.body;
        await Feedback.create({ userMessage, aiResponse, rating, userName: getRequestUserName(req), userLocation });
        res.json({ success: true, message: "Feedback saved for learning" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/correct', restrictTo('admin'), async (req, res) => {
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
        const targetName = getRequestedUserName(req);
        if (!targetName) return res.status(403).json({ success: false, message: "Forbidden" });
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const sessions = await Chat.aggregate([
            { $match: { userName: targetName } },
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
        const targetName = getRequestedUserName(req);
        if (!targetName) return res.status(403).json({ success: false, message: "Forbidden" });
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const history = await Chat.find({
            userName: targetName,
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
        const targetName = getRequestedUserName(req);
        if (!targetName) return res.status(403).json({ success: false, message: "Forbidden" });
        const history = await Chat.find({ userName: targetName })
            .sort({ timestamp: 1 })
            .limit(50);
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
