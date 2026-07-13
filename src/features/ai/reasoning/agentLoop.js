/**
 * AgentLoop Module v29.0 - (BULLETPROOF GEMINI CORE)
 * Fixes: 400 Bad Request errors, Tool-Call Mismatches, and Token Bloat.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolImplementations } = require('../tools/toolRegistry');
const MemoryEngine = require('../memory/memoryEngine');
const axios = require('axios');

class AgentLoop {
    static _normalize(entry) {
        if (!entry || typeof entry !== 'object') return [];
        if (entry.role) return [{ role: entry.role, content: entry.content || ".", tool_calls: entry.tool_calls, tool_call_id: entry.tool_call_id }];
        const out = [];
        if (entry.user) out.push({ role: 'user', content: entry.user });
        if (entry.assistant) out.push({ role: 'assistant', content: typeof entry.assistant === 'string' ? entry.assistant : "." });
        return out;
    }

    static _getSafeHistory(history) {
        const flat = [];
        for (const e of history || []) flat.push(...this._normalize(e));

        // Ensure we don't break tool/assistant pairs when slicing
        const sliced = flat.slice(-8);
        if (sliced.length > 0 && sliced[0].role === 'tool') {
            return sliced.slice(1); // Drop the orphan tool message
        }
        return sliced;
    }

    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intents = ["GENERAL"]) {
        const startTime = Date.now();
        const profile = context.profile || {};
        const userId = context.userId || profile.name || "Bhai";

        const isPlanning = intents.some(i => ['ROADMAP', 'CAREER_ADVICE', 'SSC', 'POLICE', 'BANKING'].includes(i));
        const protocol = isPlanning
            ? "MANDATORY: ASCII Bar [████░░░░░░], Sharp Question, and 3 specific tasks."
            : "MANDATORY: Direct answer. No roadmap.";

        const systemPrompt = `${dynamicSystemPrompt}\n\n# PROTOCOL\n${protocol}\n\n# CONTEXT\nUser: ${userId} | Qual: ${profile.qualification}`;

        let messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...this._getSafeHistory(history));
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
                    model, messages: sanitized,
                    tools: selectedTools.length > 0 ? selectedTools : undefined,
                    tool_choice: selectedTools.length > 0 ? "auto" : undefined,
                    temperature: 0.1, max_tokens: 1200
                }, { headers: LLMProvider.getHeaders(), timeout: 60000 });

                const assistantMessage = response.data.choices[0].message;
                if (!assistantMessage.content) assistantMessage.content = "."; // Prevent 400 errors

                LLMProvider._logAIEvent('TURN_' + iterations, { model }, assistantMessage, Date.now() - turnStart, response.data.usage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    messages.push(assistantMessage);
                    for (const toolCall of assistantMessage.tool_calls) {
                        const implementation = toolImplementations[toolCall.function.name];
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            const raw = implementation ? await implementation(args, profile) : { status: "error" };

                            if (toolCall.function.name === 'search_jobs') capturedData.jobs = raw.jobs || "";

                            // SANITIZATION
                            const toolFeedback = toolCall.function.name === 'search_jobs'
                                ? { status: "success", found: (raw.jobs || []).length, matches: (raw.jobs || []).slice(0,3).map(j => j.title).join(", ") }
                                : raw;

                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(toolFeedback) });
                        } catch (e) {
                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: "failed" });
                        }
                    }
                } else {
                    return { content: assistantMessage.content, intent: intents[0], capturedData, messages };
                }
            } catch (err) {
                console.error("🛑 AgentLoop turn error:", err.response?.data || err.message);
                return { content: "Bhai, server busy hai. Ek baar phir puchen.", intent: intents[0], capturedData: { jobs: "" } };
            }
        }
        return { content: "Bhai, main research kar raha hoon par rasta nahi mil raha. Thodi der me try karein.", intent: intents[0] };
    }
}

module.exports = AgentLoop;
