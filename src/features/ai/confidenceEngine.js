/**
 * ConfidenceEngine Module
 * Responsibility: Calculate internal confidence based on data sources and reasoning.
 */
class ConfidenceEngine {
    /**
     * @param {Object} plan - The decision object from Planner.
     * @param {Object} liveData - Data fetched from DB/Search.
     * @param {Object} validation - Result from ResponseValidator.
     * @returns {Object} Confidence report
     */
    static calculate(plan, liveData, validation) {
        let score = 70; // Base score for LLM reasoning
        const reasons = ["Reasoning completed"];

        // 1. Data Source Factor
        if (liveData.jobs || liveData.kendras) {
            score += 15;
            reasons.push("Official database records found");
        }

        if (liveData.web) {
            score += 10;
            reasons.push("External search results integrated");
        }

        // 2. Intent Match Factor
        if (validation && (validation.isValid || validation.passed)) {
            score += 5;
            reasons.push("Response matches intent logic");
        } else if (validation) {
            const validationScore = typeof validation.score === 'number' ? validation.score : (validation.severity === 'HIGH' ? 25 : 70);
            score -= (100 - validationScore) / 2;
        }

        // 3. Search Success Factor
        if (plan.needSearch && !liveData.web && !liveData.jobs) {
            score -= 20;
            reasons.push("Real-time data requested but not found");
        }

        // Clamp score
        score = Math.min(Math.max(score, 0), 100);

        let status = 'MEDIUM';
        if (score >= 90) status = 'HIGH';
        if (score < 50) status = 'LOW';

        return {
            confidence: `${score}%`,
            score: score,
            status: status,
            reasons: reasons,
            isReliable: score >= 60,
            disclaimer: score < 50 ? "I am not fully certain about this information. Please verify with official sources." : null
        };
    }
}

module.exports = ConfidenceEngine;
