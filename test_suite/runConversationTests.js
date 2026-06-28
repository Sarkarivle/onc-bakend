/**
 * Conversation Behavior Test Runner
 * Responsibility: Load conversation tests, execute AIService, and report results.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

// 1. Mock Infrastructure
const mockModel = {
    findOne: async () => ({ value: 'mock_value' }),
    find: function() {
        return {
            sort: function() {
                return {
                    lean: () => Promise.resolve([]),
                    then: (cb) => cb([]),
                    catch: (cb) => cb(new Error("Mock Error"))
                };
            },
            then: (cb) => cb([]),
            catch: (cb) => cb(new Error("Mock Error"))
        };
    },
    countDocuments: async () => 0,
    create: async (data) => data,
    skip: function() { return this; },
    limit: function() { return this; },
    sort: function() { return this; }
};

mongoose.model = (name) => mockModel;
mongoose.connect = async () => {};

// Mock SearchService to prevent real API calls
const SearchService = require('../src/features/ai/searchService');
SearchService.search = async (query) => {
    return []; // Return empty by default
};

// Mock axios to simulate LLM responses
axios.post = async (url, data) => {
    const messages = data.messages || [];
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const userQuery = messages.find(m => m.role === 'user')?.content || '';

    let content = `I can help you with ${userQuery}.`;

    // Simple rule-based mock response to simulate LLM behavior for testing
    if (userQuery.toLowerCase().includes('form kaise bhare') || userQuery.toLowerCase().includes('apply kaise kare')) {
        content = "Official site par jayein, registration karein, application form fill karein, documents upload karein, fee pay karein aur final submit karein.";
    } else if (userQuery.toLowerCase().includes('vacancy') && systemPrompt.includes('JHTET')) {
        content = "Ye ek eligibility test hai, direct vacancy nahi hai.";
    } else if (systemPrompt.includes('UPPSC PCS Pre Recruitment 2026')) {
        content = "Here are the details for UPPSC PCS Pre Recruitment 2026. You can apply online. The last date is 27 July 2026.";
    } else if (userQuery.toLowerCase().includes('doctor') || userQuery.toLowerCase().includes('mbbs')) {
        if (userQuery.toLowerCase().includes('nursing')) {
            content = "To become a doctor, MBBS is the main route via NEET. Nursing is a different healthcare career path. MBBS requires 12th PCB and NEET, while Nursing offers courses like ANM, GNM, and B.Sc Nursing.";
        } else {
            content = "To become a doctor, you should pursue MBBS after clearing NEET.";
        }
    } else if (userQuery.toLowerCase().includes('nursing')) {
        content = "Nursing is a great career in healthcare, different from being a doctor.";
    } else if (systemPrompt.includes('Jharkhand Teacher Eligibility Test JHTET 2026') || userQuery.includes('JHTET')) {
        content = "JHTET 2026 is an eligibility test, not a direct vacancy.";
    } else if (systemPrompt.includes('No verified job data found')) {
        content = "I'm sorry, I don't have verified information for that right now.";
    } else if (systemPrompt.includes('Ambiguous') || systemPrompt.includes('explain your question')) {
        content = "Please explain which job you are interested in.";
    }

    return {
        data: {
            message: {
                content: content + " [SUGGESTIONS: Details, Apply, Fees]"
            }
        }
    };
};

// 2. Load AIService and dependencies
const AIService = require('../src/features/ai/aiService');
const ConversationState = require('../src/features/ai/conversationState');
const Reporter = require('./conversationTestReporter');

// Mock Database Knowledge
AIService._fetchDatabaseKnowledge = async (query) => {
    const q = String(query || "");
    if (q.includes('UPPSC') || q.includes('2026')) {
        return {
            count: 1,
            jobs: "- JOB: UPPSC PCS Pre Recruitment 2026 | Org: UPPSC | Vacancy: 500 | Last Date: 27 July 2026"
        };
    }
    if (q.includes('JHTET')) {
        return {
            count: 1,
            jobs: "- JOB: Jharkhand Teacher Eligibility Test JHTET 2026 | Org: JAC | Vacancy: N/A | Last Date: Check Site"
        };
    }
    return { count: 0, jobs: "" };
};

async function runTests() {
    const testsDir = path.join(__dirname, 'conversation_tests');
    if (!fs.existsSync(testsDir)) {
        console.error(`❌ Tests directory not found: ${testsDir}`);
        process.exit(1);
    }
    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));

    let allResults = [];
    console.log(`\n🚀 Starting Conversation Behavior Evaluation...\n`);

    for (const file of testFiles) {
        const filePath = path.join(testsDir, file);
        const tests = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        for (const test of tests) {
            const sessionId = `test_session_${test.id}_${Date.now()}`;

            // Set initial state
            if (test.state) {
                ConversationState.sessionState.set(sessionId, {
                    ...test.state,
                    turnCount: test.state.turnCount || 0,
                    history: test.state.history || []
                });
            } else {
                ConversationState.sessionState.delete(sessionId);
            }

            try {
                const result = await AIService.processRequest({
                    userMessage: test.userMessage,
                    sessionId: sessionId,
                    userName: 'TestUser'
                });

                const updatedState = await ConversationState.get(sessionId);
                const passed = checkMatch(test, result, updatedState);

                allResults.push({
                    id: test.id,
                    description: test.description,
                    message: test.userMessage,
                    expected: test.expected,
                    actual: {
                        intent: updatedState.lastUserIntent,
                        domain: updatedState.currentDomain,
                        behavior: updatedState.lastAssistantIntent,
                        message: result.message,
                        referencedItem: updatedState.resolvedIntent?.referencedItem
                    },
                    passed
                });

                process.stdout.write(passed ? '\x1b[32m.\x1b[0m' : '\x1b[31mF\x1b[0m');
            } catch (err) {
                console.error(`\n❌ Error in test ${test.id}:`, err);
                allResults.push({
                    id: test.id,
                    description: test.description,
                    message: test.userMessage,
                    expected: test.expected,
                    actual: { error: err.message },
                    passed: false
                });
                process.stdout.write('\x1b[31mE\x1b[0m');
            }
        }
    }

    Reporter.report(allResults);
}

function checkMatch(test, result, state) {
    const expected = test.expected;
    const actualMsg = (result.message || "").toLowerCase();

    if (expected.intent && state.lastUserIntent !== expected.intent) return false;
    if (expected.domain && state.currentDomain !== expected.domain) return false;
    if (expected.behavior && state.lastAssistantIntent !== expected.behavior) return false;

    // Internal fields check
    if (expected.referencedItem && state.resolvedIntent?.referencedItem !== expected.referencedItem) return false;

    if (expected.responseContains) {
        for (const word of expected.responseContains) {
            if (!actualMsg.includes(word.toLowerCase())) return false;
        }
    }

    if (expected.responseMustNotContain) {
        for (const word of expected.responseMustNotContain) {
            if (actualMsg.includes(word.toLowerCase())) return false;
        }
    }

    if (expected.needClarification !== undefined) {
        const actualNeed = !!(state.resolvedIntent?.needClarification || state.lastAssistantIntent === 'CLARIFY');
        if (actualNeed !== !!expected.needClarification) return false;
    }

    return true;
}

runTests().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
