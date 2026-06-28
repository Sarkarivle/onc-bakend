/**
 * SemanticIntentClassifier Module
 * Layered intent architecture:
 * rules -> follow-up/context -> semantic matcher -> LLM fallback -> merger.
 */
const IntentDetector = require('./intentDetector');
const EmbeddingIntentMatcher = require('./embeddingIntentMatcher');
const LLMIntentClassifier = require('./llmIntentClassifier');
const IntentConfidenceScorer = require('./intentConfidenceScorer');
const ResolvedIntentMerger = require('./resolvedIntentMerger');
const FollowUpResolver = require('./followUpResolver');
const IndianLanguageNormalizer = require('./indianLanguageNormalizer');
const StrongIntentResolver = require('./strongIntentResolver');

class SemanticIntentClassifier {
    static async classify(query, state = {}, profile = {}) {
        const normalized = IndianLanguageNormalizer.normalize(query);

        const ruleResult = IntentDetector.detect(normalized || query);
        const rulePrimaryIntent = ruleResult.intents?.[0] || 'GENERAL_QUERY';
        const ruleIsGeneric = rulePrimaryIntent === 'GENERAL_QUERY';

        const strongIntent = StrongIntentResolver.resolve(normalized || query, ruleResult);
        const followUp = FollowUpResolver.resolve(normalized || query, state, query);
        const semanticQuery = followUp.isFollowUp ? followUp.resolvedQuery : (strongIntent ? normalized : normalized);
        const semanticMatches = EmbeddingIntentMatcher.match(semanticQuery);
        const topSemantic = semanticMatches[0] || null;

        const hasStrongContext = Boolean(
            followUp.isFollowUp ||
            (state.currentDomain && state.currentDomain !== 'GENERAL') ||
            (state.topic && state.topic !== 'GENERAL')
        );

        let confidence = IntentConfidenceScorer.calculate({
            ruleMatch: !ruleIsGeneric,
            ruleIsGeneric,
            semanticMatch: topSemantic,
            followUpIntent: followUp.intent,
            strongIntent,
            hasStrongContext,
            isPureGreeting: ruleResult.isPureGreeting
        });

        let llmResult = null;
        const lowSignal = confidence < 0.7 || (topSemantic && topSemantic.score < 0.62 && ruleIsGeneric);
        if (lowSignal && normalized.length > 3) {
            llmResult = await LLMIntentClassifier.classify(query, {
                normalizedMessage: normalized,
                topic: state.currentTopic || state.topic,
                currentDomain: state.currentDomain,
                lastAssistantAction: state.lastAssistantIntent,
                lastAssistantQuestion: state.lastAssistantQuestion,
                pendingAction: state.pendingAction,
                profile
            });
            confidence = IntentConfidenceScorer.calculate({
                ruleMatch: !ruleIsGeneric,
                ruleIsGeneric,
                semanticMatch: topSemantic,
                llmMatch: llmResult,
                followUpIntent: followUp.intent,
                strongIntent,
                hasStrongContext,
                isPureGreeting: ruleResult.isPureGreeting
            });
        }

        return ResolvedIntentMerger.merge(query, {
            normalizedMessage: normalized,
            ruleResult,
            ruleIntent: rulePrimaryIntent,
            strongIntent,
            semanticIntent: topSemantic,
            semanticMatches,
            llmIntent: llmResult,
            followUp,
            context: state,
            confidence
        });
    }
}

module.exports = SemanticIntentClassifier;
