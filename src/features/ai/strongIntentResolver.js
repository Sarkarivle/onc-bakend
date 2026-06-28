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

        const isFollowUp = /\b(sahi se batao|detail me batao|achhe se batao|clear batao|pura batao|vistaar se|explain|details? please)\b/i.test(q);
        if (isFollowUp) {
            return {
                primaryIntent: 'FIELD_DETAILS',
                domainIntent: 'FIELD_DETAILS',
                domain: 'FIELD_DETAILS',
                communicationAct: 'FOLLOW_UP',
                isFollowUp: true,
                confidence: 0.96,
                reason: 'Follow-up request for more details.'
            };
        }

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
                regex: /\b(admit card|admit crd|hall ticket|exam city)\b/
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
                regex: /\b(career|future|guidance|path|direction|aim|goal|career option|kya karu|kya kare|kya karein|ke baad|baad kya|career advice|best options|roadmap|scope|future scope|skill development|computer course|course for jobs|taiyari|tayyari|preparation|tips|freelancing|high paying|students|student|science students|exam taiyari|job kaise payein|job kaise paye|job kaise mile|kaise bane|doctor|mbbs ya nursing|nursing kaise|nursing karni|bams|bhms|medical career|police kaise bane|teacher kaise bane|engineer kaise bane|after 10th|after 12th|after graduation|after diploma|after b tech|after btech|12th ke baad|10th ke baad|graduation ke baad|diploma ke baad|b tech ke baad|btech ke baad)\b/
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

        const jobEntity = /\b(ssc|upsc|bpsc|uppsc|mppsc|rpsc|ctet|uptet|neet|jee|cuet|gate|police|constable|daroga|si|sub inspector|home guard|railway|rrb|rpf|alp|group d|ntpc|bank|ibps|sbi|rbi|clerk|po|so|army|navy|air force|agniveer|defence|bsf|crpf|cisf|itbp|ssb|teacher|teaching|prt|tgt|pgt|lecturer|professor|assistant professor|anganwadi|asha|anm|nurse|nursing|medical|health worker|health)\b/i;
        const specificJobAction = /\b(latest|new|notification|recruitment|vacancy|vacancies|bharti|rally|opening|openings|apply online|online form|form open|form nikla|exam notification|naukri|naukari|jobs|listing)\b/i;
        const examCycleAction = /\b(202[4-9]|details|update|updates|date)\b/i;
        const narrowHealthJob = /\b(nursing|medical|health|nurse|anm|gnm|asha|anganwadi)\b.*\b(job|jobs|vacancy|vacancies|bharti|recruitment|naukri|naukari|post|posts|listing)\b|\b(job|jobs|vacancy|vacancies|bharti|recruitment|naukri|naukari|post|posts|listing)\b.*\b(nursing|medical|health|nurse|anm|gnm|asha|anganwadi)\b/i;
        const explicitJobRequest = /\b(latest sarkari job|sarkari job latest|police vacancy|teacher ki vacancy|teacher vacancy|railway recruitment|ctet exam notification|ssc cgl 202[4-9]|naukri dikhao|job dikhao|koi vacancy|vacancy hai|latest vacancy)\b/i;
        const policeTitle = /\b(police constable|police si|police daroga|delhi police|up police|bihar police|mp police|rajasthan police|haryana police)\b/i;

        const hasPreciseJobIntent =
            explicitJobRequest.test(q) ||
            narrowHealthJob.test(q) ||
            policeTitle.test(q) ||
            (jobEntity.test(q) && (specificJobAction.test(q) || examCycleAction.test(q)));

        if (hasPreciseJobIntent) {
            const jobDomain = JobDomainResolver.resolve(q);
            return {
                primaryIntent: 'JOB_QUERY',
                domainIntent: jobDomain.domain,
                domain: jobDomain.graphDomain,
                task: 'LATEST',
                secondaryIntents: hasGreeting ? ['GREETING'] : [],
                confidence: 0.94,
                reason: 'Specific job/domain intent matched.'
            };
        }

        return null;
    }
}

module.exports = StrongIntentResolver;
