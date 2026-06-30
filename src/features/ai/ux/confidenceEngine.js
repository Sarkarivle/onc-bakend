/**
 * ConfidenceEngine Module
 * Responsibility: Calculates the final confidence score for the generated response.
 */
class ConfidenceEngine {
    static calculate(plan, liveData, validation) {
        let score = 70;
        const reasons = ["Reasoning completed"];

        if (liveData.jobs) {
            score += 15;
            reasons.push("Official database records found");
        }

        if (liveData.web) {
            score += 10;
            reasons.push("External search results integrated");
        }

        if (validation && validation.passed) {
            score += 5;
            reasons.push("Response matches intent logic");
        } else if (validation) {
            score -= 20;
        }

        score = Math.min(Math.max(score, 0), 100);

        let status = 'MEDIUM';
        if (score >= 90) status = 'HIGH';
        if (score < 50) status = 'LOW';

        return {
            confidence: `${score}%`,
            score: score,
            status: status,
            reasons: reasons,
            isReliable: score >= 60
        };
    }
}

module.exports = ConfidenceEngine;
