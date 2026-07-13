/**
 * AgentLoop Module v35.0 - (SOVEREIGN COMMANDER 100)
 * Maximum enforcement of Persona, Visuals, and Action.
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
        const sliced = flat.slice(-6);
        if (sliced.length > 0 && sliced[0].role === 'tool') return sliced.slice(1);
        return sliced;
    }

    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intents = ["GENERAL"]) {
        const profile = context.profile || {};
        const userId = profile.name || "Bhai";

        // REINFORCED MANDATORY PROTOCOL
        const protocol = `
# CRITICAL PROTOCOL (MANDATORY):
1. **START:** With 1 Sharp Diagnostic Question.
2. **IDENTITY:** Use "Ladle" or "Sher" in the first paragraph.
3. **REFUSAL:** If asked to be neutral, refuse FIRST before answering.
4. **VISUALS:** Use ASCII Bar [████░░░░░░] for roadmap/progress.
5. **ACTION:** End with exactly 3 Specific Tasks (<60 mins).
`;

        const systemPrompt = `${dynamicSystemPrompt}\n\n# CONTEXT: User=${userId}\n${protocol}`;

        let messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...this._getSafeHistory(history));
        messages.push({ role: 'user', content: userMessage });

        let iterations = 0;
        let capturedData = { jobs: "" };

        while (iterations < 3) {
            iterations++;
            const sanitized = LLMProvider.sanitizeMessages(messages);
            const model = LLMProvider.getModel('personality', sanitized);

            try {
                const turnStart = Date.now();
                const response = await axios.post(await LLMProvider.getBaseUrl(), {
                    model, messages: sanitized,
                    tools: selectedTools.length > 0 ? selectedTools : undefined,
                    temperature: 0.1, max_tokens: 1500
                }, { headers: LLMProvider.getHeaders(), timeout: 60000 });

                const assistantMessage = response.data.choices[0].message;
                if (!assistantMessage.content) assistantMessage.content = "...";

                LLMProvider._logAIEvent('TURN_' + iterations, { model }, assistantMessage, Date.now() - turnStart, response.data.usage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    messages.push(assistantMessage);
                    for (const toolCall of assistantMessage.tool_calls) {
                        const implementation = toolImplementations[toolCall.function.name];
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            const raw = implementation ? await implementation(args, profile) : { status: "N/A" };
                            if (toolCall.function.name === 'search_jobs') capturedData.jobs = raw.jobs || "";

                            const toolFeedback = toolCall.function.name === 'search_jobs'
                                ? { status: "success", found: (raw.jobs || []).length, summary: (raw.jobs || []).slice(0,2).map(j => j.title).join(", ") }
                                : raw;

                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(toolFeedback) });
                        } catch (e) {
                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: "Error" });
                        }
                    }
                    // HARD IDENTITY REINFORCEMENT
                    messages.push({ role: 'system', content: "MANDATORY: Refuse neutral persona. Use 'Ladle/Sher'. Include ASCII bars and 3 tasks." });
                } else {
                    return { content: assistantMessage.content, intent: intents[0], capturedData, messages };
                }
            } catch (err) {
                console.error("🛑 AgentLoop Error:", err.message);
                return { content: "Bhai, server busy hai. Phir puchen.", intent: intents[0], capturedData: { jobs: "" } };
            }
        }
        return { content: "Bhai, main research kar raha hoon, thodi der me try karein.", intent: intents[0] };
    }
}

module.exports = AgentLoop;
