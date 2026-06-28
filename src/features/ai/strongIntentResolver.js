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
                domain: 'RESULT',
                task: 'STATUS',
                regex: /\b(admit card|hall ticket|exam city)\b/
            },
            {
                primaryIntent: 'RESULT_ADMIT_CARD',
                domainIntent: 'RESULT_ADMIT_CARD',
                domain: 'RESULT',
                task: 'STATUS',
                regex: /\b(result|scorecard|score card|selection list|merit list|answer key|board exam result|result date|cutoff|cut off|marks)\b/
            },
            {
                primaryIntent: 'CAREER_GUIDANCE',
                domainIntent: 'CAREER',
                domain: 'CAREER',
                task: 'GUIDANCE',
                regex: /\b(career|future|guidance|path|direction|aim|goal|career option|kya karu|kya kare|kya karein|ke baad|baad kya|career advice|best options|roadmap|scope|future scope|skill development|computer course|course for jobs|taiyari|tayyari|preparation|tips|freelancing|high paying|students|exam taiyari|job kaise payein|doctor|mbbs|nursing|bams|bhms|medical|police kaise bane|teacher kaise bane|engineer kaise bane|12th ke baad)\b/
            },
            {
                primaryIntent: 'APPLICATION_HELP',
                domainIntent: 'GOVT_JOB',
                domain: 'GOVERNMENT_JOBS',
                task: 'APPLY_PROCESS',
                regex: /\b(kaise bharein|kaise bhare|kaise bharen|how to fill|how to apply|apply kaise kare|form kaise bhare|form bharna hai)\b/
            }
        ];

        const found = strong.find(item => item.regex.test(q));
        if (found) {
            return {
                ...found,
                communicationAct: hasGreeting ? 'QUESTION' : (found.primaryIntent === 'CAREER_GUIDANCE' ? 'QUESTION' : null),
                secondaryIntents: hasGreeting ? ['GREETING'] : [],
                confidence: 0.95,
                reason: 'Strong independent domain intent matched.'
            };
        }

        const jobEntity = /\b(ssc|upsc|bpsc|uppsc|mppsc|rpsc|ctet|uptet|neet|jee|cuet|gate|police|constable|daroga|si|sub inspector|home guard|railway|rrb|rpf|alp|group d|ntpc|bank|ibps|sbi|rbi|clerk|po|so|army|navy|air force|agniveer|defence|bsf|crpf|cisf|itbp|ssb|teacher|teaching|prt|tgt|pgt|lecturer|professor|assistant professor|anganwadi|asha|anm|nurse|nursing|health)\b/i;
        const jobAction = /\b(notification|recruitment|vacancy|vacancies|bharti|details|update|updates|year|date|rally|constable|clerk|po|jobs|job|naukri|naukari|rojgar|rozgar|202[4-5])\b/i;

        const hasJobMeaning = /\b(job|jobs|naukri|vacancy|vacancies|bharti|recruitment|government job|sarkari|railway|rrb|group d|rpf|sbi|ibps|bank|po|clerk|rbi|police|constable|daroga|home guard|army|navy|air force|agniveer|cisf|bsf|crpf|itbp|ssb|teacher|tgt|pgt|prt|ctet|tet|nurse|nursing|anm|gnm|asha|anganwadi|health worker)\b/.test(q);
        const hasJobAsk = /(job|jobs|vacancy|vacancies|bharti|naukri|kaam|rojgar|form|apply|ke liye|dikhao|batao|hai kya|chahiye| kab |kab tak|notification|recruitment|update|updates|details|year|date)/.test(q);

        if ((jobEntity.test(q) && jobAction.test(q)) || (hasJobMeaning && hasJobAsk)) {
            const jobDomain = JobDomainResolver.resolve(q);
            return {
                primaryIntent: 'JOB_QUERY',
                domainIntent: jobDomain.domain,
                domain: jobDomain.graphDomain,
                task: 'LATEST',
                secondaryIntents: hasGreeting ? ['GREETING'] : [],
                confidence: 0.94,
                reason: 'Strong job/domain intent matched.'
            };
        }

        return null;
    }
}

module.exports = StrongIntentResolver;
