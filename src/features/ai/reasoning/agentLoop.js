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
        return /Aaj ke 3 kaam:|Next\s*step\s*:|^#+\s*Next\s*Step\b|Agla step:|Ek question:/im.test(value) || /\bTask\s*3\b/i.test(value);
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

        if (words <= 2 && upper.includes('GREETING')) return 'tiny';

        // Depth now tracks the QUERY'S actual breadth, not just which domain intent it hit —
        // "SSC CGL last date kya hai" (JOB_SEARCH) should NOT get the same 2600-token,
        // 11-component treatment as "12th ke baad poora roadmap batao" (also intent-tagged
        // but genuinely broad). Intent membership alone used to force 'deep' for 17 intents,
        // leaving 'standard' almost unreachable.
        const isBroadQuery = words >= 14 ||
            /roadmap|poora plan|pura plan|puri jankari|sab kuch batao|detail(?:ed)? mein|vistar se|complete guide|step by step sab|kya kya karu|life mein kya karu|career mein kya karu|guide karo/i.test(q);

        return isBroadQuery ? 'deep' : 'standard';
    }

    static _maxTokensForDepth(depth) {
        if (depth === 'deep') return Number(process.env.LLM_DEEP_MAX_TOKENS || 2600);
        if (depth === 'tiny') return Number(process.env.LLM_TINY_MAX_TOKENS || 500);
        return Number(process.env.LLM_STANDARD_MAX_TOKENS || 1700);
    }

    static _isEarningQuery(userMessage) {
        return /\b(earning|income|paise|paisa|part[ -]?time|internship|freelance|work from home|job chahiye|kamai)\b/i.test(userMessage || "");
    }

    static _buildOutputContract(depth, intents = [], profile = {}, userMessage = '') {
        const upper = (intents || []).map(i => String(i).toUpperCase());
        const completion = this._profileCompleteness(profile);
        const earningQuery = this._isEarningQuery(userMessage);

        if (depth === 'tiny') {
            return `Keep this response short and natural. Do not add roadmap, tasks, tables, or follow-up unless the user asks.`;
        }

        const factual = upper.some(i => ['JOB_SEARCH', 'SSC', 'POLICE', 'BANKING', 'RAILWAY', 'UPSC', 'TEACHER', 'GRANTS', 'PART_TIME', 'LOCAL_SCOUT'].includes(i));
        const planning = upper.some(i => ['ROADMAP', 'CAREER_GUIDANCE', 'CAREER_ADVICE', 'ACADEMIC_AUDIT', 'SYLLABUS', 'PYQ'].includes(i));
        const learning = upper.some(i => ['CONCEPT', 'MATH', 'ENGLISH_PRACTICE'].includes(i));

        const scopeRule = depth === 'deep'
            ? `- The user asked a broad/open-ended question. A fuller structured answer (multiple options, a short roadmap, key risks) is appropriate — but still only include sections that serve THIS question, not a fixed checklist.`
            : `- The user asked a narrow/specific question. Answer ONLY that question directly. Do NOT add a roadmap, 30/60/90-day plan, risk table, task list, or mnemonic unless the user explicitly asked for one. One or two short paragraphs or a tight bullet list is enough.`;

        return `
# ADAPTIVE OUTPUT CONTRACT
- Depth: ${depth}. Give a complete answer for the user's actual query, not a generic template.
${scopeRule}
- User profile completeness: ${completion}%. Use known profile fields; if a critical field is missing, ask only one question after giving useful general guidance.
- Start with the direct answer in 1-2 lines.
${depth === 'deep' ? `- Then add only the sections that fit the query:
  ${planning ? '- For career/study planning: best paths, recommended path, a short milestone breakdown, mistakes to avoid, next step — only if the user asked for a plan/roadmap.' : ''}
  ${factual ? '- For jobs/exams/scholarships: eligibility, dates/status, official-source caveat, documents, application path, risk/verification notes — only the fields relevant to what was asked.' : ''}
  ${learning ? '- For learning: simple explanation, example, practice task, common mistake, memory trick if useful.' : ''}` : '- Do not add unrequested sections. Answer the specific question and stop.'}
- For 12th/career roadmap, do ${earningQuery ? 'include earning/part-time options because the user asked for earning.' : 'not include earning, local earning, internship, freelance, or part-time options unless the user asks for earning/jobs.'}
- Do not force exactly 3 tasks. Do not force "Bhai", "Ladle", "Sher", ASCII bars, or motivational filler.
- Use concise Hinglish for clarity, but do not pad the answer with content the user did not ask for.
`.trim();
    }

    static _stripUnsupportedSchemaFields(value) {
        if (Array.isArray(value)) return value.map(item => this._stripUnsupportedSchemaFields(item));
        if (!value || typeof value !== 'object') return value;

        const output = {};
        for (const [key, child] of Object.entries(value)) {
            if (key === 'default') continue;
            if (key === 'required' && Array.isArray(child) && child.length === 0) continue;
            output[key] = this._stripUnsupportedSchemaFields(child);
        }
        return output;
    }

    static _sanitizeToolsForProvider(tools = []) {
        return (tools || [])
            .filter(tool => tool?.type === 'function' && tool.function?.name)
            .map(tool => {
                const sanitized = this._stripUnsupportedSchemaFields(tool);
                if (!sanitized.function.parameters) {
                    sanitized.function.parameters = { type: 'object', properties: {} };
                }
                return sanitized;
            });
    }

    static _isProviderRequestError(error) {
        return [400, 422].includes(error?.response?.status);
    }

    /**
     * One retry for transient failures only (network drop, timeout, 5xx) — a single blip
     * should not immediately drop the user to canned fallback text. 4xx errors (bad request,
     * rejected tool call) are not retried here since resending the same payload won't help.
     */
    static async _postWithRetry(url, payload, headers, timeout, retries = 1) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await axios.post(url, payload, { headers, timeout });
            } catch (error) {
                const status = error?.response?.status;
                const isTransient = !status || status >= 500 || ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(error.code);
                if (isTransient && attempt < retries) {
                    await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
                    continue;
                }
                throw error;
            }
        }
    }

    /**
     * Groq/Llama sometimes emits malformed tool-call syntax (e.g. missing '>' in
     * <function=name{...}</function>), which the provider rejects with 400 tool_use_failed
     * before ever executing the tool. Recover the intended call from failed_generation
     * so grounding still works instead of silently answering without data.
     */
    static _extractMalformedToolCall(errorBody) {
        const failedGeneration = errorBody?.error?.failed_generation || '';
        if (!failedGeneration) return null;

        // Format A (older models): "<function=name{...}</function>" — malformed XML-ish syntax.
        const xmlMatch = failedGeneration.match(/<function=([a-zA-Z_][a-zA-Z0-9_]*)>?\s*(\{[\s\S]*\})\s*<\/function>/);
        if (xmlMatch) {
            try {
                return { name: xmlMatch[1], args: this._stripNullArgs(JSON.parse(xmlMatch[2])) };
            } catch (e) { /* fall through to format B */ }
        }

        // Format B (gpt-oss models): a plain '{"name": "...", "arguments": {...}}' JSON object
        // that Groq rejected only because optional fields were sent as null instead of omitted.
        try {
            const parsed = JSON.parse(failedGeneration.trim());
            const name = parsed?.name || parsed?.function?.name;
            const args = parsed?.arguments || parsed?.function?.arguments;
            if (name && args && typeof args === 'object') {
                return { name, args: this._stripNullArgs(args) };
            }
        } catch (e) { /* not JSON either — give up */ }

        return null;
    }

    /** Drop null/undefined-valued keys so a tool implementation sees "not provided" the same
     * way whether the model omitted a field or explicitly sent it as null. */
    static _stripNullArgs(args) {
        const cleaned = {};
        for (const [key, value] of Object.entries(args || {})) {
            if (value !== null && value !== undefined) cleaned[key] = value;
        }
        return cleaned;
    }

    static _logProviderError(error, stage = 'AgentLoop') {
        const status = error?.response?.status;
        const body = error?.response?.data;
        console.error(`🛑 ${stage} Error:`, error.message);
        if (status) console.error(`🛑 ${stage} Status:`, status);
        if (body) {
            const printable = typeof body === 'string' ? body : JSON.stringify(body);
            console.error(`🛑 ${stage} Body:`, printable.substring(0, 1200));
        }
    }

    static _localFallback(userMessage, intents = [], profile = {}) {
        const upper = (intents || []).map(i => String(i).toUpperCase());
        const q = String(userMessage || '').toLowerCase();

        if (upper.some(i => ['ROADMAP', 'CAREER_GUIDANCE', 'CAREER_ADVICE'].includes(i)) || /12th|career|kya karu|baad/.test(q)) {
            return [
                "Abhi exact roadmap ke liye mujhe tumhara stream/interest chahiye, par general direction ye hai:",
                "",
                "**Best options after 12th:**",
                "1. Degree path: BA/BCom/BSc/BCA/BBA, agar graduation + stable career chahiye.",
                "2. Skill path: computer, design, sales, digital marketing, coding, data entry, agar jaldi earning chahiye.",
                "3. Government exam path: SSC, Railway, Police, Banking, agar sarkari naukri target hai.",
                "4. Professional path: JEE/NEET/CLAT/NDA/CA jaise entrance, sirf tab jab interest aur eligibility match ho.",
                "",
                "**30-day plan:** apna stream, budget, city, aur interest final karo; 3 career options shortlist karo.",
                "",
                "**60-day plan:** ek option ke syllabus/course/fees/eligibility compare karo aur basic skill/test prep start karo.",
                "",
                "**90-day plan:** application, exam prep, ya portfolio/project me se ek track lock karo.",
                "",
                "Next step: tumhara 12th stream kya hai: Science, Commerce, Arts, ya kuch aur?"
            ].join('\n');
        }

        if (upper.some(i => ['JOB_SEARCH', 'SSC', 'POLICE', 'BANKING', 'RAILWAY', 'TEACHER'].includes(i)) || /job|naukri|sarkari|bharti|vacancy/.test(q)) {
            return [
                "Live job list abhi model-provider issue ki wajah se fetch nahi ho paayi, par tumhara next step clear hai.",
                "",
                "**Sarkari job check karne ke liye:**",
                "1. Qualification, age, state, category ready rakho.",
                "2. SSC, Railway, Police, Banking aur state vacancies ko official portals par verify karo.",
                "3. Apply/fee/date final karne se pehle official notification hi check karo.",
                "",
                "Next step: apni qualification, age, state aur category bata do; main eligible job categories filter kar dunga."
            ].join('\n');
        }

        return "Main abhi model-provider issue face kar raha hoon, par tum apna sawaal thoda detail me bhejo; main practical answer dunga.";
    }

    static _removeIrrelevantEarningOptions(text, userMessage) {
        if (this._isEarningQuery(userMessage)) return text;
        return String(text || '')
            .split('\n')
            .filter(line => !/\b(Local Earning|Part-time Jobs?|part-time|freelanc|immediate financial support|earning option)\b/i.test(line))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    static _dedupeNextSteps(text) {
        const lines = String(text || '').split('\n');
        let seenNextStep = false;
        const output = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isNextStep = /(^#+\s*)?Next\s*Step\s*:?\s*$/i.test(line.trim()) || /^Next\s*step\s*:/i.test(line.trim());
            if (isNextStep) {
                if (seenNextStep) {
                    while (i + 1 < lines.length && lines[i + 1].trim() && !/^#+\s|\*\*|^\d+\.|^- /.test(lines[i + 1].trim())) i++;
                    continue;
                }
                seenNextStep = true;
            }
            output.push(line);
        }

        return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    static _polishFinalText(text, userMessage) {
        return this._dedupeNextSteps(this._removeIrrelevantEarningOptions(text, userMessage));
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

        if (additions.length > 0) {
            finalText = `${additions.join("\n\n")}\n\n${finalText}`;
        }

        if (!this._hasAction(finalText) && (needsRoadmap || needsJobAction)) {
            finalText += needsRoadmap
                ? `\n\nNext step: apna interest stream bata do: Science, Commerce, Arts, Computer, ya Government job. Uske hisaab se exact roadmap bana dunga.`
                : `\n\nNext step: apni qualification, age, state aur category bata do; main eligible options filter kar dunga.`;
        }

        return this._polishFinalText(finalText, userMessage);
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

    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intents = ["GENERAL"], onToken = null, precomputedDepth = null) {
        const profile = context.profile || {};
        const userId = profile.name || "Bhai";
        const depth = precomputedDepth || this._responseDepth(userMessage, intents);
        const maxTokens = this._maxTokensForDepth(depth);

        let memoryBlock = '';
        if (userId && !['User', 'Guest'].includes(userId)) {
            const memories = await MemoryEngine.searchMemory(userId, userMessage, 5);
            if (memories.length > 0) {
                memoryBlock = `\n\n# RELEVANT MEMORIES\n${memories.map(m => `- [${m.category}] ${m.fact}`).join('\n')}`;
            }
        }

        const protocol = `
# RESPONSE PROTOCOL:
1. Be warm but natural. Do not force words like "Ladle", "Sher", or "Bada Bhai" in every answer.
2. Answer the user directly first. Ask at most one useful follow-up question.
3. Use ASCII progress bars only when the user asks for a tracker/progress view.
4. Add next steps only when they help the user's goal.
5. Never claim facts without tool/source support for jobs, exams, scholarships, or deadlines.
${this._buildOutputContract(depth, intents, profile, userMessage)}
`;

        const systemPrompt = `${dynamicSystemPrompt}\n\n# CONTEXT: User=${userId}\n${protocol}${memoryBlock}`;

        let messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...this._getSafeHistory(history));
        if (context.image_url) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: userMessage },
                    { type: 'image_url', image_url: { url: context.image_url } }
                ]
            });
        } else {
            messages.push({ role: 'user', content: userMessage });
        }
        const providerTools = this._sanitizeToolsForProvider(selectedTools);

        let iterations = 0;
        let capturedData = { jobs: "", evidence: [] };

        while (iterations < 3) {
            iterations++;
            const sanitized = LLMProvider.sanitizeMessages(messages);
            const model = LLMProvider.getModel('personality', sanitized);

            try {
                const turnStart = Date.now();
                let payload = {
                    model, messages: sanitized,
                    temperature: depth === 'deep' ? 0.35 : 0.2,
                    max_tokens: maxTokens
                };
                const allowToolsThisTurn = providerTools.length > 0 && !context.image_url && (!onToken || iterations === 1);
                if (allowToolsThisTurn) payload.tools = providerTools;

                let assistantMessage;

                if (!payload.tools && onToken) {
                    // Final content-only turn: stream tokens live to the caller.
                    const fullResponse = await LLMProvider.chatStream(sanitized, onToken, {
                        temperature: payload.temperature,
                        max_tokens: payload.max_tokens
                    });
                    assistantMessage = { role: 'assistant', content: fullResponse || "..." };
                } else {
                    let response;
                    try {
                        response = await this._postWithRetry(await LLMProvider.getBaseUrl(), payload, LLMProvider.getHeaders(), 60000);
                    } catch (error) {
                        if (payload.tools && this._isProviderRequestError(error)) {
                            this._logProviderError(error, 'AgentLoop Tool Request');

                            const recovered = this._extractMalformedToolCall(error.response?.data);
                            if (recovered && toolImplementations[recovered.name]) {
                                try {
                                    const toolResult = await toolImplementations[recovered.name](recovered.args, profile);
                                    const raw = this._normalizeToolResult(toolResult);
                                    if (recovered.name === 'search_jobs') capturedData.jobs = raw.jobs || [];
                                    if (Array.isArray(raw.evidence)) capturedData.evidence.push(...raw.evidence);
                                    if (raw.grounding?.sources) capturedData.evidence.push(...raw.grounding.sources);

                                    const toolFeedback = recovered.name === 'search_jobs'
                                        ? (raw.status === 'EMPTY_RESULT'
                                            ? { status: raw.status, message: raw.message, explanation: raw.explanation, details: raw.details }
                                            : {
                                                status: raw.status || "success",
                                                found: (raw.jobs || []).length,
                                                jobs_context: this._formatJobsForContext(raw.jobs || [], depth === 'deep' ? 10 : 6),
                                                verification: raw.grounding || null
                                            })
                                        : this._compactToolFeedback(raw);

                                    messages.push({
                                        role: 'system',
                                        content: `Tool "${recovered.name}" ran successfully (result: ${JSON.stringify(toolFeedback)}). Use this real data to produce the final grounded answer. Do not call any tool again this turn.`
                                    });
                                } catch (recoveryError) {
                                    this._logProviderError(recoveryError, 'AgentLoop Tool Recovery');
                                    messages.push({
                                        role: 'system',
                                        content: 'Tool calling was rejected by the model provider for this request. Answer without tools, state uncertainty for live jobs/dates, and do not say server busy.'
                                    });
                                }
                            } else {
                                messages.push({
                                    role: 'system',
                                    content: 'Tool calling was rejected by the model provider for this request. Answer without tools, state uncertainty for live jobs/dates, and do not say server busy.'
                                });
                            }

                            const fallbackMessages = LLMProvider.sanitizeMessages(messages);
                            response = await axios.post(await LLMProvider.getBaseUrl(), {
                                model,
                                messages: fallbackMessages,
                                temperature: depth === 'deep' ? 0.35 : 0.2,
                                max_tokens: maxTokens
                            }, {
                                headers: LLMProvider.getHeaders(),
                                timeout: 60000
                            });
                        } else {
                            throw error;
                        }
                    }

                    assistantMessage = response.data.choices[0].message;
                    if (!assistantMessage.content) assistantMessage.content = "...";
                    LLMProvider._logAIEvent('TURN_' + iterations, { model }, assistantMessage, Date.now() - turnStart, response.data.usage);
                }

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
                                ? (raw.status === 'EMPTY_RESULT'
                                    ? { status: raw.status, message: raw.message, explanation: raw.explanation, details: raw.details }
                                    : {
                                        status: raw.status || "success",
                                        found: (raw.jobs || []).length,
                                        jobs_context: this._formatJobsForContext(raw.jobs || [], depth === 'deep' ? 10 : 6),
                                        verification: raw.grounding || null
                                    })
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
                this._logProviderError(err);
                return {
                    content: this._localFallback(userMessage, intents, profile),
                    intent: intents[0],
                    capturedData: { jobs: "", evidence: [] }
                };
            }
        }
        return { content: "Bhai, main research kar raha hoon, thodi der me try karein.", intent: intents[0] };
    }

    static _formatJobsForContext(jobs = [], limit = 8) {
        return jobs.slice(0, limit).map(j => {
            const title = String(j.title || 'Untitled').slice(0, 80);
            const org = String(j.organization || 'N/A').slice(0, 80);
            const link = j.officialLinks?.apply || j.officialLinks?.notification || j.applyLink || 'link not stored';
            const lastDate = j.importantDates?.applicationLastDate || j.lastDate || 'check official notice';
            const salary = j.salary || 'not disclosed';
            const elig = j.eligibility?.status === 'ELIGIBLE' ? 'Eligible' : (j.eligibility?.reason || 'check eligibility');
            return `- ${title} | ${org} | Last date: ${lastDate} | Salary: ${salary} | Eligibility: ${elig} | Link: ${link}`;
        }).join('\n');
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
