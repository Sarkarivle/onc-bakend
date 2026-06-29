/**
 * Intent & Domain Analyzer
 * Analyzes the normalized query to determine user intent and the relevant domain.
 */

const INTENT_KEYWORDS = {
    JOB_QUERY: ['job', 'vacancy', 'bharti', 'naukri', 'form', 'recruitment'],
    CAREER_GUIDANCE: ['career', 'kya karu', 'future', 'option', 'course'],
    RESULT_ADMIT_CARD: ['result', 'admit card', 'cutoff', 'answer key'],
    RESUME: ['resume', 'cv', 'biodata'],
    SCHOLARSHIP: ['scholarship', 'wazifa', 'chatravriti'],
    FOLLOWUP: ['age', 'fees', 'salary', 'last date', 'link', 'details', 'aur batao'],
    GREETING: ['hi', 'hello', 'namaste', 'kaise ho'],
};

const DOMAIN_KEYWORDS = {
    police: ['police', 'daroga', 'constable', 'si'],
    railway: ['railway', 'rrb', 'group d', 'ntpc', 'alp'],
    teacher: ['teacher', 'shikshak', 'tet', 'ctet', 'b.ed'],
    ssc: ['ssc', 'cgl', 'chsl', 'gd'],
    army: ['army', 'sena', 'defence'],
    bank: ['bank', 'ibps', 'sbi', 'po', 'clerk'],
};

class IntentDomainAnalyzer {
    static analyze(normalizedText) {
        const text = normalizedText.toLowerCase();
        let primaryIntent = 'GENERAL_QUERY';
        let detectedDomain = null;

        // Simple keyword-based intent detection
        for (const intent in INTENT_KEYWORDS) {
            if (INTENT_KEYWORDS[intent].some(kw => text.includes(kw))) {
                primaryIntent = intent;
                break; // Find first matching intent
            }
        }

        // Simple keyword-based domain detection
        for (const domain in DOMAIN_KEYWORDS) {
            if (DOMAIN_KEYWORDS[domain].some(kw => text.includes(kw))) {
                detectedDomain = domain;
                break; // Find first matching domain
            }
        }

        return { primaryIntent, detectedDomain, confidence: 0.85, reason: 'Keyword match' };
    }
}

module.exports = IntentDomainAnalyzer;