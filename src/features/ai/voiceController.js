const AgentLoop = require('./reasoning/agentLoop');
const { getPersona } = require('./prompts/index');
const googleTTS = require('google-tts-api');

class VoiceController {
    /**
     * POST /api/v1/ai/voice-stream
     * Dedicated high-speed endpoint for voice-to-voice interaction.
     */
    static async handleVoiceStream(req, res) {
        try {
            const { query, userProfile, history, sessionId } = req.body;

            if (!query) {
                return res.status(400).json({ error: "Missing query transcription" });
            }

            console.log(`🎙️ Voice Request from ${userProfile?.name || 'Guest'}: ${query}`);

            let aiText = "";

            // FAST-PATH: Handle Greetings without LLM for instant response
            if (query.startsWith("GREETING_ONLY:")) {
                aiText = query.replace("GREETING_ONLY:", "").trim();
            } else {
                // 1. EXECUTE AGENT LOOP (High-speed configuration)
                const result = await AgentLoop.run(
                    query,
                    history || [],
                    { profile: userProfile, sessionId },
                    getPersona(userProfile?.name),
                    [], // Empty tools for ultra-low latency voice responses
                    "VOICE_CHAT"
                );
                aiText = result.content;
            }

            console.log(`🤖 AI Voice Response: ${aiText}`);

            // 2. CONVERT TEXT TO SPEECH (TTS) - GENERATE BASE64 BUFFER
            // Sanitize text for TTS (remove markdown, limit length)
            const sanitizedText = aiText
                .replace(/[*#_\[\]()]/g, '') // Remove simple markdown
                .substring(0, 200);

            try {
                const audioBase64 = await googleTTS.getAudioBase64(sanitizedText, {
                    lang: 'hi',
                    slow: false,
                    host: 'https://translate.google.com',
                });

                if (!audioBase64) throw new Error("TTS generated empty buffer");

                // 3. RESPOND WITH TEXT + BASE64 AUDIO
                res.json({
                    text: aiText,
                    audioBase64: audioBase64,
                    sessionId: sessionId
                });
            } catch (ttsError) {
                console.error("❌ TTS Error:", ttsError);
                // Fallback: Send text only if TTS fails
                res.json({
                    text: aiText,
                    error: "TTS_FAILED",
                    sessionId: sessionId
                });
            }

        } catch (error) {
            console.error("❌ Voice Controller Error:", error);
            res.status(500).json({ error: "Internal Voice Processing Error" });
        }
    }
}

module.exports = VoiceController;
