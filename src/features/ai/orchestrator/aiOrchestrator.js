/**
 * AIOrchestrator Module (Production 5-Agent Architecture)
 */
const Chat = require('../../chat/chatModel');
const { normalizeRequest, shapeResponse, SAFE_RESPONSES } = require('../quality/safetyGuard');
const SessionState = require('../context/sessionState');
const UserProfile = require('../context/userProfile');
const IntentEngine = require('../intent/intentEngine');
const AgenticPlanner = require('../reasoning/agenticPlanner');
const RetrievalEngine = require('../knowledge/retrievalEngine');
const LLMProvider = require('../generation/llmProvider');
const personalityPrompt = require('../generation/prompts/personality');
const corePrompt = require('../generation/prompts/core');
const ProgressEmitter = require('../ux/progressEmitter');
const EliteFormatter = require('../quality/eliteFormatter');
const SuggestionEngine = require('../ux/suggestionEngine');

class AIOrchestrator {
    static async processRequest(input) {
        const requestId = `req_${Date.now()}`;
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;

        try {
            ProgressEmitter.emit(sessionId, 'START');
            const [state, profile] = await Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)]);

            // 1. LOGIC PHASE (Qwen)
            ProgressEmitter.emit(sessionId, 'LOGIC_BRAIN');
            const resolvedIntent = await IntentEngine.classify(userMessage, state, profile);
            const plan = await AgenticPlanner.generatePlan(userMessage, resolvedIntent, { topic: state.topic });

            // 2. RETRIEVAL PHASE (RAG)
            let knowledge = "";
            if (plan.needsDatabase) {
                const dbResult = await RetrievalEngine.searchJobs(resolvedIntent.refinedQuery || userMessage, profile, plan);
                knowledge = dbResult?.jobs || "";
            }

            // 3. REASONING PHASE (DeepSeek)
            let reasoning = "";
            /* Temporarily skip reasoning for speed test on Llama 8b
            if (plan.mode === 'CAREER_GUIDANCE') {
                ProgressEmitter.emit(sessionId, 'DEEP_THINKING');
                reasoning = await LLMProvider.generateReasoning(`Analyze career path for: ${userMessage}. Knowledge: ${knowledge}`);
            }
            */

            // 4. PERSONALITY PHASE (Lora_v1)
            ProgressEmitter.emit(sessionId, 'GENERATING');
            const systemContent = `${corePrompt}\n${personalityPrompt}\n\nCONTEXT DATA:\nKnowledge: ${knowledge}\nReasoning: ${reasoning}\nUser Profile: ${JSON.stringify(profile)}\nState: ${JSON.stringify(state)}`;

            const aiResponse = await LLMProvider.chat([
                { role: 'system', content: systemContent },
                { role: 'user', content: userMessage }
            ]);
            let finalContent = aiResponse.content;

            // 5. VERIFICATION PHASE (Llama 3.1 8B)
            /* Temporarily skip verification for speed test on Llama 8b
            ProgressEmitter.emit(sessionId, 'VERIFYING_ACCURACY');
            const audit = await LLMProvider.verifyResponse(userMessage, finalContent, knowledge);
            if (!audit.isValid && audit.correctedAnswer) {
                finalContent = audit.correctedAnswer;
            }
            */

            // 6. SECURITY GUARD PHASE (Llama-Guard 3)
            ProgressEmitter.emit(sessionId, 'SECURITY_CHECK');
            const isSafe = await LLMProvider.guardResponse(userMessage, finalContent);
            if (!isSafe) {
                finalContent = "Maaf kijiye, main is sawal ka jawab nahi de sakta kyunki ye meri safety guidelines ke khilaf hai.";
            }

            const formatted = EliteFormatter.format(finalContent);
            const suggestions = SuggestionEngine.generate(plan, { jobs: knowledge });

            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

            return { ...shapeResponse(formatted, { suggestions }), requestId };

        } catch (error) {
            console.error("❌ Pipeline Error:", error);
            return { ...shapeResponse(SAFE_RESPONSES.GENERIC_FALLBACK), success: false, requestId };
        }
    }

    static async processRequestStream(input, onChunk) {
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;

        try {
            const [state, profile] = await Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)]);

            // 1. LOGIC PHASE
            const resolvedIntent = await IntentEngine.classify(userMessage, state, profile);
            const plan = await AgenticPlanner.generatePlan(userMessage, resolvedIntent, { topic: state.topic });

            // 2. RETRIEVAL PHASE
            let knowledge = "";
            if (plan.needsDatabase) {
                const dbResult = await RetrievalEngine.searchJobs(resolvedIntent.refinedQuery || userMessage, profile, plan);
                knowledge = dbResult?.jobs || "";
            }

            // 3. REASONING PHASE
            let reasoning = "";
            /* Skip reasoning for speed test on Llama 8b
            if (plan.mode === 'CAREER_GUIDANCE') {
                reasoning = await LLMProvider.generateReasoning(`Analyze career path for: ${userMessage}. Knowledge: ${knowledge}`);
            }
            */

            // 4. PERSONALITY PHASE (Streaming)
            let fullContent = "";
            const systemContent = `${corePrompt}\n${personalityPrompt}\n\nCONTEXT DATA:\nKnowledge: ${knowledge}\nReasoning: ${reasoning}\nUser Profile: ${JSON.stringify(profile)}\nState: ${JSON.stringify(state)}`;

            await LLMProvider.chatStream([
                { role: 'system', content: systemContent },
                { role: 'user', content: userMessage }
            ], (chunk) => {
                fullContent += chunk;
                onChunk(chunk);
            });

            // Persist after stream complete
            const formatted = EliteFormatter.format(fullContent);
            const suggestions = SuggestionEngine.generate(plan, { jobs: knowledge });
            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

        } catch (error) {
            console.error("❌ Streaming Pipeline Error:", error);
            onChunk("Bhai, server thoda slow hai. Ek baar check karo net ya thodi der me try karo.");
        }
    }

    static async _persist(userName, sessionId, query, response, suggestions) {
        await Chat.create({ userName, sessionId, role: 'user', content: query });
        await Chat.create({ userName, sessionId, role: 'assistant', content: response, suggestions });
    }
}

module.exports = AIOrchestrator;
