/**
 * AgentLoop Module v30.0 - (GEMINI IRON-CLAD CORE)
 * Goal: 100% Visual Adherence (ASCII Bars) without losing 65-point logic.
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
        const sliced = flat.slice(-8);
        if (sliced.length > 0 && sliced[0].role === 'tool') return sliced.slice(1);
        return sliced;
    }

    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intents = ["GENERAL"]) {
        const profile = context.profile || {};
        const userId = context.userId || profile.name || "Bhai";

        const isPlanning = intents.some(i => ['ROADMAP', 'CAREER_ADVICE', 'SSC', 'POLICE', 'BANKING', 'UPSC'].includes(i));

        // REINFORCED PROTOCOL
        const protocol = isPlanning
            ? "# MANDATORY VISUAL PROTOCOL:\n- You MUST start your response with a Sharp Diagnostic Question.\n- You MUST include at least one ASCII Progress Bar [████░░░░░░].\n- You MUST end with EXACTLY 3 specific 24-hour tasks."
            : "# MANDATORY DIRECT PROTOCOL:\n- Direct answer only. No long roadmap. Max 2 paragraphs.";

        // CONTEXT + PROMPT (Protocol at the very end for Recency Bias)
        const systemPrompt = `${dynamicSystemPrompt}\n\n# USER CONTEXT\nName: ${userId} | Qual: ${profile.qualification}\n\n${protocol}`;

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
                    temperature: 0.1, max_tokens: 1500
                }, { headers: LLMProvider.getHeaders(), timeout: 60000 });

                const assistantMessage = response.data.choices[0].message;
                if (!assistantMessage.content) assistantMessage.content = ".";

                LLMProvider._logAIEvent('TURN_' + iterations, { model }, assistantMessage, Date.now() - turnStart, response.data.usage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    messages.push(assistantMessage);
                    for (const toolCall of assistantMessage.tool_calls) {
                        const implementation = toolImplementations[toolCall.function.name];
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            const raw = implementation ? await implementation(args, profile) : { status: "error" };
                            if (toolCall.function.name === 'search_jobs') capturedData.jobs = raw.jobs || "";

                            const toolFeedback = toolCall.function.name === 'search_jobs'
                                ? { status: "success", found: (raw.jobs || []).length, matches: (raw.jobs || []).slice(0,3).map(j => j.title).join(", ") }
                                : raw;

                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(toolFeedback) });
                        } catch (e) {
                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: "failed" });
                        }
                    }
                    // RE-INFORCE VISUALS after tool calls
                    if (isPlanning) messages.push({ role: 'system', content: "REMINDER: Now provide the final response with the MANDATORY ASCII bar [████░░░░░░] and 3 tasks." });
                } else {
                    return { content: assistantMessage.content, intent: intents[0], capturedData, messages };
                }
            } catch (err) {
                console.error("🛑 AgentLoop Error:", err.message);
                return { content: "Bhai, server busy hai. Ek baar phir puchen.", intent: intents[0], capturedData: { jobs: "" } };
            }
        }
        return { content: "Main research kar raha hoon par rasta nahi mil raha. Thodi der me try karein.", intent: intents[0] };
    }
}

module.exports = AgentLoop;
