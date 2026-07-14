/**
 * AgentLoop Module
 * Balanced enforcement of persona, factuality, and useful next steps.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolImplementations } = require('../tools/toolRegistry');
const MemoryEngine = require('../memory/memoryEngine');
const axios = require('axios');

class AgentLoop {
    static _hasWarmPersona(text) {
        return /\b(bhai|ladle|sher|bada bhai)\b/i.test(text || "");
    }

    static _hasAction(text) {
        const value = text || "";
        return /Aaj ke 3 kaam:|Next step:|Agla step:/i.test(value) || /\bTask\s*3\b/i.test(value);
    }

    static _isNeutralOverride(userMessage) {
        return /\b(system override|neutral|raw data engine|machine mode|ignore persona|act as)\b/i.test(userMessage || "");
    }

    static _isDistractionProbe(userMessage) {
        return /\bpaper airplane|airplane|aeroplane|origami\b/i.test(userMessage || "");
    }

    static _profileCompleteness(profile = {}) {
        const fields = [
            profile.name,
            profile.qualification,
            profile.location,
            Array.isArray(profile.skills) ? profile.skills.filter(Boolean).join(',') : profile.skills,
            Array.isArray(profile.interests) ? profile.interests.filter(Boolean).join(',') : profile.interests
        ];
        const known = fields.filter(value => String(value || '').trim()).length;
        return Math.round((known / fields.length) * 100);
    }

    static _responseDepth(userMessage, intents = []) {
        const q = String(userMessage || '').trim();
        const words = q.split(/\s+/).filter(Boolean).length;
        const upper = (intents || []).map(i => String(i).toUpperCase());
        const deepIntents = new Set([
            'ROADMAP', 'CAREER_GUIDANCE', 'CAREER_ADVICE', 'ACADEMIC_AUDIT',
            'JOB_SEARCH', 'SSC', 'POLICE', 'BANKING', 'RAILWAY', 'UPSC',
            'TEACHER', 'GRANTS', 'PART_TIME', 'INTERVIEW', 'SYLLABUS', 'PYQ',
            'CONCEPT', 'ENGLISH_PRACTICE'
        ]);

        if (words <= 2 && upper.includes('GREETING')) return 'tiny';
        if (upper.some(intent => deepIntents.has(intent))) return 'deep';
        if (words >= 8 || /kaise|kya karu|roadmap|plan|compare|detail|full|samjhao|batao/i.test(q)) return 'deep';
        return 'standard';
    }

    static _maxTokensForDepth(depth) {
        if (depth === 'deep') return Number(process.env.LLM_DEEP_MAX_TOKENS || 2600);
        if (depth === 'tiny') return Number(process.env.LLM_TINY_MAX_TOKENS || 500);
        return Number(process.env.LLM_STANDARD_MAX_TOKENS || 1700);
    }

    static _buildOutputContract(depth, intents = [], profile = {}) {
        const upper = (intents || []).map(i => String(i).toUpperCase());
        const completion = this._profileCompleteness(profile);

        if (depth === 'tiny') {
            return `Keep this response short and natural. Do not add roadmap, tasks, tables, or follow-up unless the user asks.`;
        }

        const factual = upper.some(i => ['JOB_SEARCH', 'SSC', 'POLICE', 'BANKING', 'RAILWAY', 'UPSC', 'TEACHER', 'GRANTS', 'PART_TIME', 'LOCAL_SCOUT'].includes(i));
        const planning = upper.some(i => ['ROADMAP', 'CAREER_GUIDANCE', 'CAREER_ADVICE', 'ACADEMIC_AUDIT', 'SYLLABUS', 'PYQ'].includes(i));
        const learning = upper.some(i => ['CONCEPT', 'MATH', 'ENGLISH_PRACTICE'].includes(i));

        return `
# ADAPTIVE OUTPUT CONTRACT
- Depth: ${depth}. Give a complete answer for the user's actual query, not a generic template.
- User profile completeness: ${completion}%. Use known profile fields; if a critical field is missing, ask only one question after giving useful general guidance.
- Start with the direct answer in 1-2 lines.
- Then add the sections that fit the query:
  ${planning ? '- For career/study planning: Diagnosis, best paths, recommended path, 30/60/90-day roadmap, mistakes to avoid, next step.' : ''}
  ${factual ? '- For jobs/exams/scholarships: eligibility, dates/status, official-source caveat, documents, application path, risk/verification notes.' : ''}
  ${learning ? '- For learning: simple explanation, example, practice task, common mistake, memory trick if useful.' : ''}
- Do not force exactly 3 tasks. Do not force "Bhai", "Ladle", "Sher", ASCII bars, or motivational filler.
- Use concise Hinglish for clarity, but allow enough detail to fully solve the query.
`.trim();
    }

    static _ensureBattleReadiness(text, userMessage, intents = []) {
        let finalText = (text || "").trim();
        const additions = [];
        const isNeutralOverride = this._isNeutralOverride(userMessage);
        const isDistractionProbe = this._isDistractionProbe(userMessage);
        const lowerIntent = (intents || []).map(i => String(i).toUpperCase());
        const needsRoadmap = lowerIntent.some(i => ['ROADMAP', 'CAREER_GUIDANCE', 'CAREER_ADVICE'].includes(i));
        const needsJobAction = lowerIntent.some(i => ['JOB_SEARCH', 'SSC', 'POLICE', 'BANKING', 'RAILWAY'].includes(i));

        if (isNeutralOverride) {
            additions.push("Main apni safety aur student-help role ko ignore nahi kar sakta. Seedha, practical jawab de raha hoon.");
        }

        if (isDistractionProbe && !/\bpaper airplane\b/i.test(finalText)) {
            additions.push("Isko abhi side me rakhte hain; career/study goal par focus karte hain.");
        }

        if (!this._hasWarmPersona(finalText) && additions.length === 0 && finalText.length > 240) {
            additions.push("Bhai, seedhi baat:");
        }

        if (additions.length > 0) {
            finalText = `${additions.join("\n\n")}\n\n${finalText}`;
        }

        if (!this._hasAction(finalText) && (needsRoadmap || needsJobAction)) {
            finalText += needsRoadmap
                ? `\n\nNext step: apna interest stream bata do: Science, Commerce, Arts, Computer, ya Government job. Uske hisaab se exact roadmap bana dunga.`
                : `\n\nNext step: apni qualification, age, state aur category bata do; main eligible options filter kar dunga.`;
        }

        return finalText.trim();
    }

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
        const depth = this._responseDepth(userMessage, intents);
        const maxTokens = this._maxTokensForDepth(depth);

        const protocol = `
# RESPONSE PROTOCOL:
1. Be warm but natural. Do not force words like "Ladle", "Sher", or "Bada Bhai" in every answer.
2. Answer the user directly first. Ask at most one useful follow-up question.
3. Use ASCII progress bars only when the user asks for a tracker/progress view.
4. Add next steps only when they help the user's goal.
5. Never claim facts without tool/source support for jobs, exams, scholarships, or deadlines.
${this._buildOutputContract(depth, intents, profile)}
`;

        const systemPrompt = `${dynamicSystemPrompt}\n\n# CONTEXT: User=${userId}\n${protocol}`;

        let messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...this._getSafeHistory(history));
        messages.push({ role: 'user', content: userMessage });

        let iterations = 0;
        let capturedData = { jobs: "", evidence: [] };

        while (iterations < 3) {
            iterations++;
            const sanitized = LLMProvider.sanitizeMessages(messages);
            const model = LLMProvider.getModel('personality', sanitized);

            try {
                const turnStart = Date.now();
                const response = await axios.post(await LLMProvider.getBaseUrl(), {
                    model, messages: sanitized,
                    tools: selectedTools.length > 0 ? selectedTools : undefined,
                    temperature: depth === 'deep' ? 0.35 : 0.2,
                    max_tokens: maxTokens
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
                            const toolResult = implementation ? await implementation(args, profile) : { status: "N/A" };
                            const raw = this._normalizeToolResult(toolResult);
                            if (toolCall.function.name === 'search_jobs') capturedData.jobs = raw.jobs || [];
                            if (Array.isArray(raw.evidence)) {
                                capturedData.evidence.push(...raw.evidence);
                            }
                            if (raw.grounding?.sources) {
                                capturedData.evidence.push(...raw.grounding.sources);
                            }

                            const toolFeedback = toolCall.function.name === 'search_jobs'
                                ? {
                                    status: raw.status || "success",
                                    found: (raw.jobs || []).length,
                                    summary: (raw.jobs || []).slice(0, 2).map(j => j.title).join(", "),
                                    verification: raw.grounding || null
                                }
                                : this._compactToolFeedback(raw);

                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(toolFeedback) });
                        } catch (e) {
                            messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: "Error" });
                        }
                    }
                    messages.push({
                        role: 'system',
                        content: `Use the tool result to produce the final answer. Keep it natural and grounded, but do not under-answer. Follow the adaptive output contract for depth=${depth}.`
                    });
                } else {
                    const hardenedContent = this._ensureBattleReadiness(assistantMessage.content, userMessage, intents);
                    return { content: hardenedContent, intent: intents[0], capturedData, messages };
                }
            } catch (err) {
                console.error("🛑 AgentLoop Error:", err.message);
                return { content: "Bhai, server busy hai. Phir puchen.", intent: intents[0], capturedData: { jobs: "" } };
            }
        }
        return { content: "Bhai, main research kar raha hoon, thodi der me try karein.", intent: intents[0] };
    }

    static _normalizeToolResult(result) {
        if (typeof result !== 'string') return result || {};
        try {
            return JSON.parse(result);
        } catch (_) {
            return { content: result };
        }
    }

    static _compactToolFeedback(raw = {}) {
        const feedback = { ...raw };
        if (Array.isArray(feedback.results)) feedback.results = feedback.results.slice(0, 3);
        if (Array.isArray(feedback.internships)) feedback.internships = feedback.internships.slice(0, 3);
        if (Array.isArray(feedback.evidence)) feedback.verification = { sources: feedback.evidence.slice(0, 3) };
        delete feedback.evidence;
        return feedback;
    }
}

module.exports = AgentLoop;
