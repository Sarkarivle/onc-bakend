const AIService = require('./aiService');
const ConversationState = require('./conversationState');

/**
 * Jobo AI - Enterprise Test Suite
 * Scenarios:
 * 1. Simple Greeting (Should be fast, no search)
 * 2. Ambiguous Input (Should be rewritten)
 * 3. Contextual Follow-up (Should use memory)
 * 4. Real-time Search (Should trigger RAG & Reranker)
 */

async function runTests() {
    console.log("🚀 Starting Enterprise AI Pipeline Test...\n");

    const sessionId = "test-session-" + Date.now();
    const commonProfile = {
        userName: "Himanshu",
        userLocation: "Bareilly",
        userDOB: "2000-01-01",
        userCategory: "OBC",
        userQualification: "Graduate",
        sessionId: sessionId
    };

    const scenarios = [
        {
            name: "SCENARIO 1: Basic Greeting",
            input: "Namaste Jobo!",
            check: (res) => res.confidence >= 0.7 && !res.topic
        },
        {
            name: "SCENARIO 2: Ambiguous Query (SSC)",
            input: "ssc",
            check: (res) => res.topic === "SSC" && res.message.length > 20
        },
        {
            name: "SCENARIO 3: Contextual Memory (Age Limit)",
            input: "Isme age limit kya hai?",
            check: (res) => res.topic === "SSC" // Should remember SSC from Scenario 2
        },
        {
            name: "SCENARIO 4: Real-time Search (Latest Vacancy)",
            input: "SSC GD ki latest vacancy 2024 kab aayegi?",
            check: (res) => res.confidence >= 0.8
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n--- Testing ${scenario.name} ---`);
        console.log(`User: ${scenario.input}`);

        const start = Date.now();
        try {
            const result = await AIService.processRequest({
                ...commonProfile,
                userMessage: scenario.input,
                history: []
            });

            const latency = Date.now() - start;

            console.log(`✅ Success: ${result.success}`);
            console.log(`⏱️ Latency: ${latency}ms`);
            console.log(`📊 Confidence: ${result.confidence}%`);
            console.log(`📌 Detected Topic: ${result.topic || 'None'}`);
            console.log(`🤖 Response: ${result.message.substring(0, 100)}...`);

            if (scenario.check && !scenario.check(result)) {
                console.warn("⚠️ Validation Warning: Scenario logic check failed.");
            }
        } catch (err) {
            console.error(`❌ Scenario Failed: ${err.message}`);
        }
    }

    console.log("\n🏁 Test Suite Completed.");
}

// In a real environment, you'd need to mock the Database and LLM for unit tests.
// Here we run it to ensure the code structure doesn't crash.
runTests();
