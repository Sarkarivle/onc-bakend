/**
 * IntentConfidenceScorer Module
 * Responsibility: Calculate confidence across rule, semantic, context, and LLM layers.
 */
class IntentConfidenceScorer {
    static calculate(data) {
        let score = 0;

        if (data.followUpIntent) score = Math.max(score, 0.92);
        if (data.strongIntent) score = Math.max(score, data.strongIntent.confidence || 0.93);
        if (data.ruleMatch) score = Math.max(score, data.ruleIsGeneric ? 0.55 : 0.88);

        if (data.semanticMatch) {
            if (data.semanticMatch.score >= 0.85) score = Math.max(score, 0.9);
            else if (data.semanticMatch.score >= 0.7) score = Math.max(score, 0.82);
            else score = Math.max(score, data.semanticMatch.score);
        }

        if (data.llmMatch?.confidence) {
            score = Math.max(score, data.llmMatch.confidence);
        }

        if (data.hasStrongContext && score >= 0.55) {
            score = Math.min(0.95, score + 0.12);
        }

        if (data.isPureGreeting) score = Math.max(score, 0.98);

        return Number(Math.min(1, score).toFixed(2));
    }
}

module.exports = IntentConfidenceScorer;
