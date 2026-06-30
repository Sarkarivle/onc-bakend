/**
 * Assertions Module (Formerly ResponseValidators)
 * Responsibility: Provides error-throwing assertions for AI responses.
 */
const { FORBIDDEN_PHRASES } = require('./forbiddenPhrases');

function assertNoForbiddenPhrases(response) {
    const text = response.toLowerCase();
    const found = FORBIDDEN_PHRASES.filter(phrase => text.includes(phrase.toLowerCase()));
    if (found.length > 0) {
        throw new Error(`Backend Leak Detected. Found: ${found.join(', ')}`);
    }
}

function assertNoFakeJobFacts(response, sourceData) {
    const text = response.toLowerCase();
    const sourceText = (sourceData || "").toLowerCase();

    const numbers = text.match(/\d{3,}/g) || [];
    for (const num of numbers) {
        if (!sourceText.includes(num)) {
            throw new Error(`Hallucination Detected: Invented number "${num}" not found in source data.`);
        }
    }

    if (!sourceData || sourceData.length === 0) {
        const forbiddenFacts = ['vacancy:', 'last date:', 'salary:', 'age limit:', 'fee:', 'official link:'];
        for (const fact of forbiddenFacts) {
            if (text.includes(fact)) {
                throw new Error(`Hallucination Detected: Mentioned "${fact}" without any source data.`);
            }
        }
    }
}

function assertNoExpiredJobs(response, currentDate = new Date()) {
    const dateMatches = response.matchAll(/Last Date:\s*\*\*([\s\S]*?)\*\*/gi);
    for (const match of dateMatches) {
        const dateStr = match[1];
        try {
            const jobDate = new Date(dateStr);
            if (jobDate < currentDate) {
                throw new Error(`Expired Job Found: Job with last date "${dateStr}" is in the past.`);
            }
        } catch (e) {}
    }
}

function assertUsesDatabaseWhenAvailable(response, dbResult) {
    if (dbResult && dbResult.count > 0) {
        if (response.toLowerCase().includes("verified jankari nahi mili")) {
            throw new Error("Routing Error: Did not use available database data.");
        }
    }
}

function assertGreetingIsShort(response) {
    const text = response.toLowerCase();
    if (text.length > 150) throw new Error("Greeting response is too long.");
    const forbiddenInGreeting = ['job', 'vacancy', 'career', 'resume', 'pro tip:'];
    for (const phrase of forbiddenInGreeting) {
        if (text.includes(phrase)) throw new Error(`Greeting response contains unnecessary info: "${phrase}"`);
    }
}

function assertSafeFallback(response) {
    const text = response.toLowerCase();
    if (!text.includes("maaf kijiye") && !text.includes("verified jankari nahi mili")) {
        throw new Error("Fallback response is not safe or helpful.");
    }
    assertNoForbiddenPhrases(text);
}

module.exports = {
    assertNoForbiddenPhrases,
    assertNoFakeJobFacts,
    assertNoExpiredJobs,
    assertUsesDatabaseWhenAvailable,
    assertGreetingIsShort,
    assertSafeFallback,
};
