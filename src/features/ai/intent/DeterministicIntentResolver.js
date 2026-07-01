/**
 * DeterministicIntentResolver Module
 * Responsibility: Provides fast, rule-based resolution for common intents and behaviors
 * before attempting more expensive semantic or LLM-based classification.
 */

const GREETINGS = ['hi', 'hello', 'kaise ho', 'namaste', 'ram ram', 'hey', 'good morning', 'good evening', 'suprabhat', 'kya haal hai', 'suno', 'help'];
const IDENTITY_QUERIES = ['who are you', 'tum kaun ho', 'aapka naam kya hai', 'tell me about yourself', 'kya kaam karte ho'];
const THANKS_OK = ['theek hai', 'shukriya', 'ok thanks', 'acha ji', 'thank you', 'ok'];
const AMBIGUOUS_SHORT = ['naukri', 'fees?', 'form kaise bharein?', 'details', 'help'];

const SAFETY_BLOCK_KEYWORDS = [
    // Prompt Injection & Internal Info
    'ignore previous', 'system prompt', 'internal rules', 'developer key', 'config.json',
    'reveal your', 'underlying model', 'architecture', 'safety filters',
    // Malicious & Unsafe
    'hack', 'admin access', 'internal database', 'system command', 'rm -rf',
    'steal passwords', 'private data', 'dirty joke', 'drugs', 'scam people'
];

class DeterministicIntentResolver {
    static resolve(query) {
        const normalizedQuery = query.toLowerCase().trim();

        if (!normalizedQuery) {
            return this._createResponse({ behavior: 'BLOCK', reasoning: 'Empty query' });
        }

        // 1. Safety Block
        if (SAFETY_BLOCK_KEYWORDS.some(keyword => normalizedQuery.includes(keyword))) {
            return this._createResponse({
                intent: 'SAFETY_VIOLATION',
                behavior: 'BLOCK',
                reasoning: 'Safety keyword match'
            });
        }

        // 2. Greetings & Simple Help
        if (GREETINGS.some(g => normalizedQuery.startsWith(g) || normalizedQuery.endsWith(g))) {
             return this._createResponse({
                intent: 'GREETING',
                behavior: 'GREET',
                reasoning: 'Greeting keyword match'
            });
        }

        // 3. Identity Queries
        if (IDENTITY_QUERIES.some(q => normalizedQuery.includes(q))) {
            return this._createResponse({
                intent: 'IDENTITY',
                behavior: 'RESPOND',
                reasoning: 'Identity query match'
            });
        }

        // 4. Thanks / OK
        if (THANKS_OK.includes(normalizedQuery)) {
            return this._createResponse({
                intent: 'ACKNOWLEDGEMENT',
                behavior: 'OK_RESPONSE',
                reasoning: 'Acknowledgement phrase match'
            });
        }

        // 5. Ambiguous Short Queries
        if (AMBIGUOUS_SHORT.includes(normalizedQuery)) {
            return this._createResponse({
                intent: 'AMBIGUOUS_QUERY',
                behavior: 'CLARIFY',
                reasoning: 'Short ambiguous query'
            });
        }

        // 6. Garbage Input
        if (/^[\d\s.,?!]+$/.test(normalizedQuery) || /^[a-z]{1,4}$/.test(normalizedQuery) || !/[a-z0-9]/i.test(normalizedQuery)) {
             if (normalizedQuery.length < 5 && /^\d+$/.test(normalizedQuery)) {
                // pass for now, could be age or number
             } else {
                return this._createResponse({
                    intent: 'GARBAGE',
                    behavior: 'BLOCK',
                    reasoning: 'Garbage/random input'
                });
             }
        }

        // No deterministic match found
        return null;
    }

    /**
     * Helper to create a consistent response object that satisfies the IntentEngine contract.
     */
    static _createResponse({ intent, behavior, reasoning }) {
        const normalizedIntent = intent;
        return {
            rawIntent: intent,
            normalizedIntent: normalizedIntent,
            intent: intent, // For backward compatibility in tests
            domain: 'GENERAL',
            act: 'INFORM',
            mode: behavior === 'GREET' ? 'GENERAL_HELP' : 'FALLBACK',
            behavior: behavior,
            confidence: 1.0,
            slots: {},
            needsClarification: behavior === 'CLARIFY',
            reasoningShort: `Deterministic: ${reasoning}`
        };
    }
}

module.exports = DeterministicIntentResolver;