/**
 * AgentLoop Module v28.0 - (GEMINI SOVEREIGN CORE)
 * Features: Zero-JSON Leakage, Auto-Correction, and Token Efficiency.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolImplementations } = require('../tools/toolRegistry');
const MemoryEngine = require('../memory/memoryEngine');
const axios = require('axios');

class AgentLoop {
    static _normalizeHistoryEntry(entry) {
        if (!entry || typeof entry !== 'object') return [];
        if (entry.role) return [entry];
        const msgs = [];
        if (entry.user) msgs.push({ role: 'user', content: entry.user });
        if (entry.assistant) msgs.push({ role: 'assistant', content: typeof entry.assistant === 'string' ? entry.assistant : "" });
        return msgs;
    }

    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intents = ["GENERAL"]) {
        const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const profile = context.profile || {};
        const userId = context.userId || profile.name || "Bhai";

        const isPlanning = intents.some(i => ['ROADMAP', 'CAREER_ADVICE', 'SSC', 'POLICE', 'BANKING'].includes(i));
        const protocol = isPlanning
            ? "MANDATORY: 1 Sharp Diagnostic Question + ASCII Progress Bar + 3 Specific Tasks."
            : "MANDATORY: Direct concise answer. No roadmap.";

        const systemPrompt = `${dynamicSystemPrompt}\n\n# PROTOCOL\n${protocol}\n\n# OPERATIONAL CONTEXT\nToday: ${today} | User: ${userId} (${profile.qualification})`;

        let messages = [{ role: 'system', content: systemPrompt }];
        const flatHistory = [];
        for (const entry of history || []) flatHistory.push(...this._normalizeHistoryEntry(entry));
        messages.push(...flatHistory.slice(-6));
        messages.push({ role: 'user', content: userMessage });

        let iterations = 0;
        let capturedData = { jobs: "", documents: [] };

        while (iterations < 3) {
            iterations++;
            const sanitized = LLMProvider.sanitizeMessages(messages);
            const model = LLMProvider.getModel('personality', sanitized);

            try {
                const turnStart = Date.now();
                const response = await axios.post(await LLMProvider.getBaseUrl(), {
                    model, messages: sanitized, tools: selectedTools.length > 0 ? selectedTools : undefined,
                    temperature: 0.1, max_tokens: 1200
                }, { headers: LLMProvider.getHeaders(), timeout: 60000 });

                const assistantMessage = response.data.choices[0].message;
                LLMProvider._logAIEvent('TURN_' + iterations, { model }, assistantMessage, Date.now() - turnStart, response.data.usage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    messages.push(assistantMessage);
                    for (const toolCall of assistantMessage.tool_calls) {
                        const implementation = toolImplementations[toolCall.function.name];
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            const raw = implementation ? await implementation(args, profile) : { error: "N/A" };

                            // INTERNAL DATA CAPTURE
                            if (toolCall.function.name === 'search_jobs') capturedData.jobs = raw.jobs || "";

                            // SANITIZED FEEDBACK TO AI
                            const toolFeedback = toolCall.function.name === 'search_jobs'
                                ? { status: "success", results: (raw.jobs || []).slice(0,3).map(j => j.title).join(", ") }
                                : raw;

                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(toolFeedback) });
                        } catch (e) { messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: "Error" }); }
                    }
                } else {
                    // --- SOVEREIGN QUALITY CHECK ---
                    let content = assistantMessage.content || "";

                    // 1. JSON Leakage Prevention
                    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                        console.warn("⚠️ JSON Leakage Detected! Forcing Re-generation...");
                        messages.push({ role: 'system', content: "CRITICAL: You just output raw JSON. Translate this into a warm 'Bada Bhai' Hinglish response immediately." });
                        iterations--; continue;
                    }

                    // 2. Generic Answer Prevention
                    if (content.length < 50 && !intents.includes('GREETING')) {
                        messages.push({ role: 'system', content: "CRITICAL: Your answer is too short. Provide a more helpful, detailed response." });
                        iterations--; continue;
                    }

                    return { content, intent: intents[0], capturedData, messages };
                }
            } catch (err) { throw err; }
        }
        return { content: "Bhai, server thoda slow hai, ek baar phir puchen.", intent: intents[0] };
    }
}

module.exports = AgentLoop;
