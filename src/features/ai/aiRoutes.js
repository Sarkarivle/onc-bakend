const express = require('express');
const Feedback = require('../feedback/feedbackModel');
const Chat = require('../chat/chatModel');
const Correction = require('./correctionModel');
const AIOrchestrator = require('./orchestrator/aiOrchestrator');

const router = express.Router();

// This router intentionally preserves the original /api/v1/ai/* behavior.
// app.js mounts it at /api/v1/ai, so each path below is relative to that base.

// AI Feedback Route (Learning System)
router.post('/feedback', async (req, res) => {
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
router.post('/correct', async (req, res) => {
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

// Get unique chat sessions for a user. The aggregation is unchanged so the
// Flutter history drawer keeps receiving the same session shape.
router.get('/sessions/:userName', async (req, res) => {
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

// Keep the specific session-history route before the legacy one-param route
// so Express does not consume /history/:userName/:sessionId too early.
router.get('/history/:userName/:sessionId', async (req, res) => {
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

// Legacy history route kept for older clients that do not send a session id.
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

// AI assistant route. Error responses intentionally keep HTTP 200 because the
// existing mobile client treats the body shape, not the status code, as the AI fallback contract.
router.post('/ask', async (req, res) => {
    try {
        const response = await AIOrchestrator.processRequest(req.body);
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

// Streaming AI route. The SSE event format is unchanged for Flutter's parser.
router.post('/ask-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        await AIOrchestrator.processRequest(req.body, (chunk) => {
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

module.exports = router;
