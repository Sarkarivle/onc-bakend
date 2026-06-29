const { backendLeakPhrases, fakeFactRiskPhrases } = require('./forbiddenPhrases');

const synonymGroups = {
    "eligibility test": [
        "eligibility test",
        "eligibility exam",
        "yogyata pariksha",
        "पात्रता परीक्षा"
    ],
    "not a direct vacancy": [
        "not a direct vacancy",
        "direct vacancy nahi",
        "direct vacancy नहीं",
        "direct recruitment nahi",
        "direct bharti nahi",
        "direct bharti nahi hai",
        "vacancy nahi hai",
        "सीधी भर्ती नहीं"
    ],
    "no verified data": [
        "verified jankari nahi mili",
        "verified information nahi hai",
        "abhi pakki jankari nahi hai",
        "official notification verify nahi hua",
        "please official website check karein",
        "maaf kijiye",
        "i'm sorry"
    ]
};

function normalizeText(text) {
    return String(text || "").toLowerCase().trim();
}

function containsAny(text, phrases) {
    const normalized = normalizeText(text);
    return phrases.some(phrase => normalized.includes(normalizeText(phrase)));
}

function containsAllMeaning(text, expectedPhrases) {
    const normalized = normalizeText(text);
    for (const phrase of expectedPhrases) {
        const synonyms = synonymGroups[phrase.toLowerCase()] || [phrase];
        if (!synonyms.some(s => normalized.includes(s.toLowerCase()))) {
            return false;
        }
    }
    return true;
}

function doesNotContainForbidden(text, forbiddenList) {
    const normalized = normalizeText(text);
    return !forbiddenList.some(phrase => normalized.includes(phrase.toLowerCase()));
}

function isSafeNoDataResponse(text) {
    return containsAny(text, synonymGroups["no verified data"]) &&
           doesNotContainForbidden(text, fakeFactRiskPhrases);
}

function isEligibilityTestResponse(text) {
    return containsAllMeaning(text, ["eligibility test", "not a direct vacancy"]);
}

function hasNoBackendLeak(text) {
    return doesNotContainForbidden(text, backendLeakPhrases);
}

function hasNoFakeJobFacts(text, context) {
    const hasDataSource = context?.mockData?.activeJobs?.length > 0 || context?.mockData?.webSnippets?.length > 0;
    if (hasDataSource) return true; // If data exists, this check is not applicable
    return doesNotContainForbidden(text, fakeFactRiskPhrases);
}

module.exports = {
    normalizeText, containsAny, containsAllMeaning, doesNotContainForbidden,
    isSafeNoDataResponse, isEligibilityTestResponse, hasNoBackendLeak, hasNoFakeJobFacts
};