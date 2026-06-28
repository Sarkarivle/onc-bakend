/**
 * StrongIntentResolver
 * Runs before generic field-detail detection so independent domains win.
 */
const JobDomainResolver = require('./jobDomainResolver');

class StrongIntentResolver {
    static resolve(text = "", ruleResult = {}) {
        const q = String(text).toLowerCase().trim();
        const acts = new Set(ruleResult.acts || []);
        const hasGreeting = acts.has('GREET') || /^(hi|hello|namaste|namaskar|hey|hii|ram ram)\b/.test(q);

        const strong = [
            {
                primaryIntent: 'RESUME',
                domainIntent: 'RESUME',
                domain: 'RESUME',
                task: 'DETAILS',
                regex: /\b(resume|cv|curriculum vitae|resume template|cv template|resume example|fresher resume|resume summary|cv builder)\b/
            },
            {
                primaryIntent: 'SCHOLARSHIP',
                domainIntent: 'SCHOLARSHIP',
                domain: 'SCHOLARSHIP',
                task: 'LATEST',
                regex: /\b(scholarship|wazifa|chatravriti|छात्रवृत्ति|stipend|nsp|pre matric|post matric|central sector|obc scholarship|girl student scholarship)\b/
            },
            {
                primaryIntent: 'RESULT_ADMIT_CARD',
                domainIntent: 'RESULT_ADMIT_CARD',
                domain: 'ADMIT_CARD',
                task: 'STATUS',
                regex: /\b(admit card|hall ticket|exam city)\b/
            },
            {
                primaryIntent: 'RESULT_ADMIT_CARD',
                domainIntent: 'RESULT_ADMIT_CARD',
                domain: 'RESULT',
                task: 'STATUS',
                regex: /\b(result|scorecard|score card|selection list|merit list|answer key|board exam result|result date)\b/
            }
        ];

        const found = strong.find(item => item.regex.test(q));
        if (found) {
            return {
                ...found,
                communicationAct: hasGreeting ? 'QUESTION' : null,
                secondaryIntents: hasGreeting ? ['GREETING'] : [],
                confidence: 0.94,
                reason: 'Strong independent domain intent matched.'
            };
        }

        const hasJobMeaning = /\b(job|jobs|naukri|vacancy|bharti|recruitment|government job|sarkari|railway|rrb|group d|rpf|sbi|ibps|bank|po|clerk|rbi|police|constable|daroga|home guard|army|navy|air force|agniveer|cisf|bsf|crpf|itbp|ssb|teacher|tgt|pgt|prt|ctet|tet|nurse|nursing|anm|gnm|asha|anganwadi|health worker)\b/.test(q);
        const hasJobAsk = /(job|jobs|vacancy|bharti|naukri|kaam|rojgar|form|apply|ke liye|dikhao|batao|hai kya|chahiye)/.test(q);
        if (hasJobMeaning && hasJobAsk) {
            const jobDomain = JobDomainResolver.resolve(q);
            return {
                primaryIntent: 'JOB_QUERY',
                domainIntent: jobDomain.domain,
                domain: jobDomain.graphDomain,
                task: 'LATEST',
                secondaryIntents: hasGreeting ? ['GREETING'] : [],
                confidence: 0.93,
                reason: 'Strong job/domain intent matched.'
            };
        }

        return null;
    }
}

module.exports = StrongIntentResolver;
