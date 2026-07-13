/**
 * AgentLoop Module v25.0 - (ULTRA-LEAN SOVEREIGN WORKER)
 * Fixed Syntax Errors and Universal Token Sanitization.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolImplementations } = require('../tools/toolRegistry');
const MemoryEngine = require('../memory/memoryEngine');
const axios = require('axios');

class AgentLoop {
    static _normalizeHistoryEntry(entry) {
        if (!entry || typeof entry !== 'object') return [];
        if (entry.role) {
            const normalized = { role: entry.role };
            if (Object.prototype.hasOwnProperty.call(entry, 'content')) normalized.content = entry.content;
            else if (entry.role === 'assistant' && entry.tool_calls) normalized.content = "";
            if (entry.tool_calls) normalized.tool_calls = entry.tool_calls;
            if (entry.tool_call_id) normalized.tool_call_id = entry.tool_call_id;
            if (entry.name) normalized.name = entry.name;
            return [normalized];
        }
        const normalizedMessages = [];
        if (entry.user) normalizedMessages.push({ role: 'user', content: entry.user });
        if (entry.assistant) {
            if (typeof entry.assistant === 'object' && entry.assistant !== null) {
                normalizedMessages.push(...AgentLoop._normalizeHistoryEntry({ role: 'assistant', ...entry.assistant }));
            } else { normalizedMessages.push({ role: 'assistant', content: entry.assistant }); }
        }
        return normalizedMessages;
    }

    static _unrollHistoryWithContextStitching(history) {
        const flatHistory = [];
        for (const entry of history || []) flatHistory.push(...AgentLoop._normalizeHistoryEntry(entry));
        return flatHistory.slice(-10); // Keep only last 10 for tokens
    }

    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intents = ["GENERAL"]) {
        const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const profile = context.profile || {};
        const userId = context.userId || profile.name || "Bhai";
        const primaryIntent = intents[0];

        const isPlanning = intents.some(i => ['ROADMAP', 'CAREER_ADVICE', 'ACADEMIC_AUDIT'].includes(i));
        const dynamicReminder = isPlanning
            ? "STRICT: Use ASCII bars [████░░░░░░] and a 3-task roadmap."
            : "STRICT: Give a DIRECT answer. No roadmap. Brief paragraphs.";

        const systemPrompt = `# PROTOCOL\n${dynamicSystemPrompt}\n\n# CONTEXT\nToday: ${today} | User: ${userId}\nReminder: ${dynamicReminder}`;

        let messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...AgentLoop._unrollHistoryWithContextStitching(history));
        messages.push({ role: 'user', content: userMessage });

        let iterations = 0;
        let capturedData = { jobs: "", documents: [] };

        while (iterations < 3) { // Max 3 iterations for speed
            iterations++;
                const model = LLMProvider.getModel('personality', sanitizedMessages);

                const payload = {
                    model,
                    messages: sanitizedMessages.concat([{
                        role: 'system',
                        content: dynamicReminder
                    }]),
                    tools: selectedTools.length > 0 ? selectedTools : undefined,
                    tool_choice: selectedTools.length > 0 ? "auto" : undefined,
                    temperature: 0.1,
                    max_tokens: 1000
                };

                let response = await axios.post(await LLMProvider.getBaseUrl(), payload, { headers: LLMProvider.getHeaders(), timeout: 60000 });

                const assistantMessage = response.data.choices[0].message;

                // Unified AI Logging
                LLMProvider._logAIEvent('AGENT_LOOP_TURN_' + iterations, payload, assistantMessage, 0, response.data.usage);

                messages.push(assistantMessage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    for (const toolCall of assistantMessage.tool_calls) {
                        const implementation = toolImplementations[toolCall.function.name];
                        let toolResult;
                        try {
                            const args = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
                            const raw = implementation ? await implementation(args, profile) : { error: "N/A" };

                            // UNIVERSAL SANITIZER: Smart Summary for High-Intel responses
                            if (toolCall.function.name === 'search_jobs' && raw.jobs) {
                                capturedData.jobs = raw.jobs || "";
                                toolResult = {
                                    status: "success",
                                    total: (raw.jobs || []).length,
                                    top_matches: (raw.jobs || []).slice(0, 3).map(j => ({
                                        title: j.title,
                                        match: j.matchScore + "%",
                                        eligibility: j.eligibility?.status || "Unknown"
                                    }))
                                };
                            } else {
                                const str = JSON.stringify(raw);
                                toolResult = str.length > 200 ? str.substring(0, 200) + "..." : raw;
                            }
                        } catch (e) { toolResult = { error: "failed" }; }
                        messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(toolResult) });
                    }
                } else {
                    return { content: assistantMessage.content, intent: primaryIntent, capturedData, messages };
                }
            } catch (err) { throw err; }
        }
        return { content: "Bhai, server busy hai. Thodi der mein puchen.", intent: primaryIntent };
    }
}

module.exports = AgentLoop;
