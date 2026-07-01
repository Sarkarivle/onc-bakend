/**
 * AIOrchestrator Module (Production 10-Phase Neural Pipeline)
 * Responsibility: Coordinating the request journey from Smart Gateway to Elite Formatting.
 */
const Chat = require('../../chat/chatModel');
const { normalizeRequest, shapeResponse, SAFE_RESPONSES } = require('../quality/safetyGuard');
const SmartGateway = require('../quality/smartGateway');
const SessionState = require('../context/sessionState');
const UserProfile = require('../context/userProfile');
const IntentEngine = require('../intent/intentEngine');
const AgenticPlanner = require('../reasoning/agenticPlanner');
const RetrievalEngine = require('../knowledge/retrievalEngine');
const PromptComposer = require('../generation/promptComposer');
const LLMProvider = require('../generation/llmProvider');
const ProgressEmitter = require('../ux/progressEmitter');
const EliteFormatter = require('../quality/eliteFormatter');
const SuggestionEngine = require('../ux/suggestionEngine');

class AIOrchestrator {
    static initialized = false;

    static async _ensureInitialized() {
        if (!this.initialized) {
            await SmartGateway.initialize();
            this.initialized = true;
        }
    }

    static async processRequest(input) {
        const requestId = `req_${Date.now()}`;
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;

        try {
            await this._ensureInitialized();
            ProgressEmitter.emit(sessionId, 'REQUEST_RECEIVED');

            // PHASE 1: SMART GATEWAY (Safety & Greetings)
            ProgressEmitter.emit(sessionId, 'INPUT_PROCESSING');
            const gateResult = await SmartGateway.validate(userMessage);

            if (gateResult.status === 'BLOCK') {
                const blockMsg = gateResult.reason === 'MALICIOUS_INTENT'
                    ? SAFE_RESPONSES.INJECTION_ATTEMPT
                    : SAFE_RESPONSES.EMPTY_INPUT;
                return { ...shapeResponse(blockMsg), requestId };
            }

            if (gateResult.status === 'GREET') {
                return { ...shapeResponse(SAFE_RESPONSES.GREETING), requestId };
            }

            // PHASE 2 & 3: CONTEXT & INTENT
            ProgressEmitter.emit(sessionId, 'CONVERSATION_STATE_LOADING');
            const [state, profile] = await Promise.all([
                SessionState.get(sessionId),
                UserProfile.get(userName, input)
            ]);

            ProgressEmitter.emit(sessionId, 'INTENT_DETECTION');
            const contract = await IntentEngine.classify(userMessage, state, profile);

            // NEURAL MEMORY: Track topic evolution
            if (contract.entities?.job || contract.subIntent) {
                state.lastTopic = contract.entities?.job || contract.subIntent;
                await SessionState.update(sessionId, { query: userMessage, resolvedIntent: contract });
            }

            // PHASE 4: AGENTIC PLANNING
            ProgressEmitter.emit(sessionId, 'PLANNING');
            const plan = await AgenticPlanner.generatePlan(userMessage, contract, { topic: state.topic });

            // PHASE 5: RETRIEVAL (RAG)
            ProgressEmitter.emit(sessionId, 'DATABASE_CHECKING');
            let knowledge = "";
            if (plan.needsDatabase) {
                const queryToSearch = contract.refinedQuery || userMessage;
                const dbResult = await RetrievalEngine.searchJobs(queryToSearch, profile, plan);
                knowledge = dbResult?.jobs || "";
            }

            // PHASE 6: REASONING (DeepSeek Thinking)
            let reasoning = "";
            if (plan.mode === 'CAREER_GUIDANCE') {
                ProgressEmitter.emit(sessionId, 'LLM_THINKING');
                reasoning = await LLMProvider.generateReasoning(`Analyze career path for: ${userMessage}. Knowledge: ${knowledge}`);
            }

            // PHASE 7: PROMPT COMPOSITION
            ProgressEmitter.emit(sessionId, 'PROMPT_COMPOSING');
            const systemPrompt = await PromptComposer.build(
                plan.priorityModules,
                { name: userName, ...profile, state },
                { jobs: knowledge },
                { sessionId, turnCount: state.turnCount, behavior: plan.behavior, plan, currentDate: new Date().toLocaleDateString() }
            );

            // PHASE 8: GENERATION
            ProgressEmitter.emit(sessionId, 'LLM_THINKING');
            const aiResponse = await LLMProvider.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ]);

            let finalContent = aiResponse.content;

            // Extract content from <USER_MESSAGE> tags if present
            if (finalContent.includes('<USER_MESSAGE>')) {
                const match = finalContent.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
                if (match) finalContent = match[1].trim();
            }

            // PHASE 9: NEURAL SELF-CRITIQUE (Verification)
            if (knowledge && knowledge.length > 50) {
                ProgressEmitter.emit(sessionId, 'RESPONSE_VALIDATION');
                const audit = await LLMProvider.verifyResponse(userMessage, finalContent, knowledge);
                if (audit && !audit.isValid && audit.correctedAnswer) {
                    console.log("🛠 Correcting Hallucination:", audit.reason);
                    finalContent = audit.correctedAnswer;
                }
            }

            // PHASE 10: SECURITY GUARD
            const isSafe = await LLMProvider.guardResponse(userMessage, finalContent);
            if (!isSafe) {
                finalContent = SAFE_RESPONSES.UNSAFE_OUTPUT;
            }

            // PHASE 11: FORMATTING & UX
            ProgressEmitter.emit(sessionId, 'RESPONSE_FORMATTING');
            const formatted = EliteFormatter.format(finalContent, {
                intent: contract.normalizedIntent,
                userProfile: profile
            });
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: knowledge });

            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

            ProgressEmitter.emit(sessionId, 'FINAL_RESPONSE_READY');
            return { ...shapeResponse(formatted, { suggestions }), requestId };

        } catch (error) {
            console.error("❌ Pipeline Error:", error);
            ProgressEmitter.emit(sessionId, 'ERROR');
            return { ...shapeResponse(SAFE_RESPONSES.GENERIC_FALLBACK), success: false, requestId };
        }
    }

    static async processRequestStream(input, onChunk, onStatus) {
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;

        try {
            await this._ensureInitialized();
            if (onStatus) onStatus('INPUT_PROCESSING', 'Message samajh raha hoon...');

            // Minimalist stream pipeline for speed
            const [state, profile] = await Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)]);

            if (onStatus) onStatus('INTENT_DETECTION', 'Sawal ka intent samajh raha hoon...');
            const resolvedIntent = await IntentEngine.classify(userMessage, state, profile);

            if (onStatus) onStatus('PLANNING', 'Best tareeka soch raha hoon...');
            const plan = await AgenticPlanner.generatePlan(userMessage, resolvedIntent, { topic: state.topic });

            let knowledge = "";
            if (plan.needsDatabase) {
                if (onStatus) onStatus('DATABASE_CHECKING', 'Database check kar raha hoon...');
                const dbResult = await RetrievalEngine.searchJobs(resolvedIntent.refinedQuery || userMessage, profile, plan);
                knowledge = dbResult?.jobs || "";
            }

            if (onStatus) onStatus('LLM_THINKING', 'Jawab soch raha hoon...');
            const priorityModules = [resolvedIntent.primaryIntent, plan.mode].filter(Boolean);
            const systemPrompt = await PromptComposer.build(
                priorityModules,
                { name: userName, ...profile, state },
                { jobs: knowledge },
                { sessionId, turnCount: state.turnCount, behavior: plan.behavior, plan, currentDate: new Date().toLocaleDateString() }
            );

            let fullContent = "";
            let isInsideUserMessage = false;

            await LLMProvider.chatStream([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ], (chunk) => {
                fullContent += chunk;

                // If model uses tags, we only stream what's inside <USER_MESSAGE>
                if (fullContent.includes('<USER_MESSAGE>')) {
                    if (!isInsideUserMessage) {
                        const startIndex = fullContent.indexOf('<USER_MESSAGE>') + '<USER_MESSAGE>'.length;
                        const streamable = fullContent.substring(startIndex);
                        if (streamable.length > 0) {
                            onChunk(streamable);
                            isInsideUserMessage = true;
                        }
                    } else {
                        // Just send the chunk, but watch for closing tag
                        if (!chunk.includes('</USER_MESSAGE>')) {
                            onChunk(chunk);
                        } else {
                            const lastPart = chunk.split('</USER_MESSAGE>')[0];
                            onChunk(lastPart);
                        }
                    }
                } else if (!fullContent.includes('<')) {
                    // Fallback for models not using tags
                    onChunk(chunk);
                }
            });

            // Cleanup for persistence
            let finalContent = fullContent;
            const match = fullContent.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
            if (match) finalContent = match[1].trim();

            const formatted = EliteFormatter.format(finalContent, { intent: resolvedIntent.primaryIntent, userProfile: profile });
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: knowledge });
            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

        } catch (error) {
            console.error("❌ Streaming Pipeline Error:", error);
            onChunk("Bhai, system thoda busy hai. Ek baar check karo net ya thodi der me try karo.");
        }
    }

    static async _persist(userName, sessionId, query, response, suggestions) {
        try {
            const name = userName || "User";
            await Chat.create({ userName: name, sessionId, role: 'user', content: query });
            await Chat.create({ userName: name, sessionId, role: 'assistant', content: response, suggestions });
        } catch (e) {
            console.error("❌ Persistence Error:", e.message);
        }
    }
}

module.exports = AIOrchestrator;
