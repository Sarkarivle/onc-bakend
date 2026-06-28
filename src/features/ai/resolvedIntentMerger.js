/**
 * ResolvedIntentMerger Module
 * Responsibility: Merge rule, semantic, follow-up, and LLM signals into one rich intent object.
 */
const IntentExampleRegistry = require('./intentExampleRegistry');
const JobDomainResolver = require('./jobDomainResolver');

class ResolvedIntentMerger {
    static merge(originalMessage, layers) {
        const {
            ruleResult,
            ruleIntent,
            strongIntent,
            semanticIntent,
            llmIntent,
            followUp,
            context = {},
            confidence
        } = layers;
        const normalizedMessage = layers.normalizedMessage || originalMessage.toLowerCase().trim();

        const canonicalRule = this._canonicalizeRule(ruleIntent, ruleResult, context);
        const semanticPrimary = semanticIntent?.score >= 0.62 ? semanticIntent.intent : null;
        const llmPrimary = llmIntent?.primaryIntent || null;
        const followUpPrimary = followUp?.intent || null;

        const strongTakesPriority = strongIntent && (
            ['RESUME', 'SCHOLARSHIP'].includes(strongIntent.primaryIntent) ||
            (strongIntent.primaryIntent === 'RESULT_ADMIT_CARD' && !followUp?.isFollowUp)
        );
        let primary = strongTakesPriority
            ? strongIntent.primaryIntent
            : (followUpPrimary || strongIntent?.primaryIntent || canonicalRule || semanticPrimary || llmPrimary || 'GENERAL_QUERY');
        if (primary === 'CONFIRM' || primary === 'USER_CONFIRMED') primary = 'CONFIRMATION';
        if (primary === 'USER_REJECTED') primary = 'NEGATION';

        const secondary = new Set();
        for (const intent of strongIntent?.secondaryIntents || []) secondary.add(intent);
        if (canonicalRule && canonicalRule !== primary) secondary.add(canonicalRule);
        if (semanticPrimary && semanticPrimary !== primary) secondary.add(semanticPrimary);
        if (llmPrimary && llmPrimary !== primary) secondary.add(llmPrimary);
        for (const intent of this._semanticSecondaries(layers.semanticMatches || [], primary)) secondary.add(intent);

        const domain = this._resolveDomain(primary, {
            ruleResult,
            strongIntent,
            semanticIntent,
            llmIntent,
            followUp,
            context
        });
        const graphDomain = strongIntent?.domain || this._graphDomain(domain, primary);
        const task = this._task(primary, followUp?.entities || llmIntent?.entities || {});
        const communicationAct = this._communicationAct(primary, ruleResult, followUp);

        const isPureGreeting = (ruleResult?.isPureGreeting || primary === 'GREETING') && !this._hasDomainSignal(ruleResult, strongIntent, semanticPrimary, primary);
        const isFollowUp = Boolean(followUp?.isFollowUp || llmIntent?.isFollowUp);
        const needClarification = Boolean(followUp?.needClarification || llmIntent?.needClarification || this._needsClarification(primary, confidence, context, isFollowUp));
        const dataSourceNeeded = this._dataSourceNeeded(graphDomain, task, primary);

        return {
            originalMessage,
            normalizedMessage,
            resolvedQuery: followUp?.resolvedQuery || originalMessage,
            communicationAct,
            communicationActs: this._communicationActs(ruleResult, communicationAct, isFollowUp),
            domain: graphDomain,
            task,
            primaryIntent: primary,
            secondaryIntents: Array.from(secondary),
            domainIntent: domain,
            resolvedIntent: primary,
            isFollowUp,
            isPureGreeting,
            confidence,
            entities: {
                ...(llmIntent?.entities || {}),
                ...(followUp?.entities || {})
            },
            referencedTopic: followUp?.referencedTopic || context.currentTopic || context.topic || null,
            referencedItem: followUp?.referencedItem || this._lastShownItem(context),
            needClarification,
            dataSourceNeeded,
            reason: this._reason(primary, { canonicalRule, semanticIntent, llmIntent, followUp })
        };
    }

    static _canonicalizeRule(ruleIntent, ruleResult = {}, context = {}) {
        if (!ruleIntent || ruleIntent === 'GENERAL_QUERY') return null;

        const intents = new Set(ruleResult.intents || []);
        const domains = new Set(ruleResult.domains || []);
        const lastItems = context.lastShownItems || context.lastShownJobs || [];
        const isSingleItem = lastItems.length === 1;

        if (ruleIntent === 'PURE_GREETING' || ruleIntent === 'SMALL_TALK_GREETING') return 'GREETING';
        if (ruleIntent === 'CONTINUE_PREVIOUS_TOPIC') return isSingleItem ? 'FIELD_DETAILS' : 'MORE_RESULTS';
        if (ruleIntent === 'USER_CONFIRMED') return 'CONFIRMATION';
        if (ruleIntent === 'USER_REJECTED') return 'NEGATION';
        if (ruleIntent === 'APPLY_ONLINE') return 'APPLICATION_HELP';
        if (ruleIntent === 'CHECK_RESULT' || ruleIntent === 'CHECK_ADMIT_CARD') return 'RESULT_ADMIT_CARD';

        if (ruleIntent.startsWith('CHECK_') || ruleIntent === 'DOWNLOAD_NOTIFICATION') {
            if (['CHECK_DETAILS', 'DOWNLOAD_NOTIFICATION', 'CHECK_VACANCY_DETAILS'].includes(ruleIntent)) {
                if (!isSingleItem && (domains.has('GOVT_JOB') || domains.has('EXAM'))) return 'JOB_QUERY';
            }
            return 'FIELD_DETAILS';
        }

        if (ruleIntent.startsWith('FILTER_BY_')) return domains.has('GOVT_JOB') ? 'JOB_QUERY' : 'FIELD_DETAILS';
        if (ruleIntent === 'FIND_LATEST_JOBS') return 'JOB_QUERY';
        if (domains.has('RESUME')) return 'RESUME';
        if (domains.has('SCHOLARSHIP')) return 'SCHOLARSHIP';
        if (domains.has('CAREER')) return 'CAREER_GUIDANCE';
        if (domains.has('GOVT_JOB') || domains.has('EXAM')) return 'JOB_QUERY';
        if (intents.has('CHECK_RESULT') || intents.has('CHECK_ADMIT_CARD')) return 'RESULT_ADMIT_CARD';

        return ruleIntent;
    }

    static _resolveDomain(primary, data) {
        if (data.strongIntent?.domainIntent) return data.strongIntent.domainIntent;
        if (data.followUp?.domainIntent) return data.followUp.domainIntent;
        if (data.semanticIntent?.domainIntent) return data.semanticIntent.domainIntent;
        if (data.llmIntent?.domainIntent) return data.llmIntent.domainIntent;

        const metaDomain = IntentExampleRegistry.getMetadata(primary).domainIntent;
        if (metaDomain && metaDomain !== 'GENERAL') return metaDomain;

        const domains = data.ruleResult?.domains || [];
        const subDomain = Array.from(domains).find(d => ['RAILWAY_JOB', 'BANK_JOB', 'POLICE_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB'].includes(d));
        if (subDomain) return subDomain;
        if (domains.some(d => d.endsWith('_JOB'))) return JobDomainResolver.resolve(data.ruleResult?.normalizedMessage || '').domain;
        if (domains.includes('GOVT_JOB') || domains.includes('EXAM')) return 'GOVT_JOB';
        if (domains.includes('CAREER')) return 'CAREER';
        if (domains.includes('SCHOLARSHIP')) return 'SCHOLARSHIP';
        if (domains.includes('RESUME')) return 'RESUME';
        if (data.context?.currentDomain && data.context.currentDomain !== 'GENERAL' && data.followUp?.isFollowUp) {
            return data.context.currentDomain;
        }

        return metaDomain || 'GENERAL';
    }

    static _semanticSecondaries(matches, primary) {
        return matches
            .filter(match => match.intent !== primary && match.score >= 0.68)
            .slice(0, 2)
            .map(match => match.intent);
    }

    static _communicationAct(primary, ruleResult = {}, followUp = {}) {
        if (followUp?.isFollowUp) return 'FOLLOW_UP';
        if (primary === 'GREETING') return 'GREETING';
        if (primary === 'CONFIRMATION') return 'CONFIRMATION';
        if (primary === 'NEGATION') return 'NEGATION';
        if ((ruleResult.acts || []).includes('THANK')) return 'THANKS';
        if ((ruleResult.acts || []).includes('INQUIRE')) return 'QUESTION';
        return 'QUESTION';
    }

    static _communicationActs(ruleResult = {}, primaryAct, isFollowUp) {
        const acts = new Set([primaryAct]);
        for (const act of ruleResult.acts || []) {
            if (act === 'GREET') acts.add('GREETING');
            if (act === 'CONFIRM') acts.add('CONFIRMATION');
            if (act === 'NEGATE') acts.add('NEGATION');
            if (act === 'INQUIRE') acts.add('QUESTION');
            if (act === 'THANK') acts.add('THANKS');
        }
        if (isFollowUp) acts.add('FOLLOW_UP');
        return Array.from(acts);
    }

    static _graphDomain(domain, primary) {
        const map = {
            GOVT_JOB: 'GOVERNMENT_JOBS',
            RAILWAY_JOB: 'RAILWAY_JOB',
            BANK_JOB: 'BANK_JOB',
            POLICE_JOB: 'POLICE_JOB',
            DEFENCE_JOB: 'DEFENCE_JOB',
            TEACHING_JOB: 'TEACHING_JOB',
            HEALTH_JOB: 'HEALTH_JOB',
            CAREER: 'CAREER',
            RESUME: 'RESUME',
            SCHOLARSHIP: 'SCHOLARSHIP',
            COLLEGE: 'COLLEGE',
            RESULT_ADMIT_CARD: primary === 'RESULT_ADMIT_CARD' ? 'RESULT' : 'ADMIT_CARD',
            NONE: 'GENERAL',
            GENERAL: 'GENERAL'
        };
        if (primary === 'RESULT_ADMIT_CARD') return 'RESULT';
        return map[domain] || domain || 'GENERAL';
    }

    static _task(primary, entities = {}) {
        if (primary === 'JOB_QUERY') return 'LATEST';
        if (['MORE_JOBS', 'MORE_RESULTS', 'MORE_SCHOLARSHIPS', 'MORE_COLLEGES', 'MORE_CAREER_OPTIONS'].includes(primary)) return 'MORE_RESULTS';
        if (primary === 'APPLICATION_HELP') return 'APPLY_PROCESS';
        if (primary === 'JOB_FEE_DETAILS' || entities.field === 'fees') return 'FEE';
        if (primary === 'JOB_AGE_LIMIT' || entities.field === 'age') return 'AGE_LIMIT';
        if (entities.field === 'eligibility') return 'ELIGIBILITY';
        if (primary === 'JOB_LINK_DETAILS' || entities.field === 'officialLink') return 'DOWNLOAD';
        if (primary === 'EXPLAIN_LAST_FAILURE') return 'EXPLAIN_FAILURE';
        if (primary === 'SHOW_FULL_DETAILS' || primary === 'FIELD_DETAILS') return 'DETAILS';
        if (primary === 'RESULT_ADMIT_CARD') return 'STATUS';
        if (primary === 'RESUME') return 'DETAILS';
        if (primary === 'CAREER_GUIDANCE') return 'DETAILS';
        if (primary === 'SCHOLARSHIP') return 'LATEST';
        return 'DETAILS';
    }

    static _dataSourceNeeded(domain, task, primary) {
        if (primary === 'GREETING' || primary === 'CONFIRMATION' || primary === 'NEGATION') return 'NONE';
        if (['GOVERNMENT_JOBS', 'RAILWAY_JOB', 'BANK_JOB', 'POLICE_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB', 'SCHOLARSHIP', 'COLLEGE', 'RESULT', 'ADMIT_CARD'].includes(domain)) {
            if (task === 'LATEST' || task === 'MORE_RESULTS') return 'DATABASE_FIRST';
            if (['DETAILS', 'FEE', 'AGE_LIMIT', 'ELIGIBILITY', 'DOWNLOAD', 'STATUS', 'APPLY_PROCESS'].includes(task)) return 'DATABASE_OR_VERIFIED_SEARCH';
        }
        if (domain === 'CAREER' || domain === 'RESUME') return 'PROFILE_AND_LLM';
        return 'LLM';
    }

    static _needsClarification(primary, confidence, context, isFollowUp) {
        if (primary === 'GREETING' || primary === 'NEGATION') return false;
        if (primary === 'PROFILE_INFO') return true;
        if (confidence >= 0.85) return false;
        if (confidence >= 0.6 && isFollowUp && context.currentDomain && context.currentDomain !== 'GENERAL') return false;
        return confidence < 0.6 || primary === 'GENERAL_QUERY';
    }

    static _hasDomainSignal(ruleResult = {}, strongIntent, semanticPrimary, primary) {
        if (strongIntent) return true;
        if (primary && primary !== 'GREETING' && primary !== 'CONFIRMATION' && primary !== 'NEGATION') return true;
        const domains = ruleResult.domains || [];
        return domains.some(domain => domain && domain !== 'NONE' && domain !== 'GENERAL');
    }

    static _lastShownItem(context = {}) {
        if (Array.isArray(context.lastShownItems) && context.lastShownItems.length > 0) return context.lastShownItems[0];
        if (Array.isArray(context.lastShownJobs) && context.lastShownJobs.length > 0) return context.lastShownJobs[0];
        return null;
    }

    static _reason(primary, data) {
        if (data.followUp?.isFollowUp) return `Resolved as ${primary} from conversation context.`;
        if (data.canonicalRule) return `Resolved as ${primary} from fast rule detector.`;
        if (data.semanticIntent?.intent === primary) return `Resolved as ${primary} from semantic examples.`;
        if (data.llmIntent) return `Resolved as ${primary} from LLM classifier fallback.`;
        return `Resolved as ${primary}.`;
    }
}

module.exports = ResolvedIntentMerger;
