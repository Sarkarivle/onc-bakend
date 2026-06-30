/**
 * RuleDetector Module (Formerly IntentDetector)
 * Responsibility: Keyword & Regex based intent detection.
 */
class RuleDetector {
    static async detectSemantic(query, state, profile) {
        // Updated path to IntentEngine
        const IntentEngine = require('../intentEngine');
        return await IntentEngine.classify(query, state, profile);
    }

    static detect(query = "") {
        const q = query.toLowerCase().trim();
        const acts = new Set();
        const domains = new Set();
        const intents = new Set();

        if (!q) return { acts: ['EMPTY'], domains: ['GENERAL'], intents: ['NO_INPUT'] };

        // Seasonal Logic
        const currentMonth = new Date().getMonth();
        if (q.match(/(exams|exam kab hai|paper|boards|result)/i)) {
            if (currentMonth >= 1 && currentMonth <= 3) intents.add('EXAM_SEASON_QUERY');
            if (currentMonth >= 4 && currentMonth <= 6) intents.add('RESULT_SEASON_QUERY');
        }

        const isPureGreeting = q.match(/^(hi|hello|namaste|namaskar|hey|hii|hiii|heyy|adaab|ram ram|kaise ho|hi kaise ho|kya haal hai|suprabhat|shubh sandhya|hello jobo|hi jobo|hey jobo|hello dost|hi dost|namaste bro|hello bro|hey bhai|namaste bhai|bolo|kya ho rha h|kya chal rha h)$/i) !== null;

        if (isPureGreeting) {
            return { acts: ['GREET'], domains: ['NONE'], intents: ['PURE_GREETING'], isPureGreeting: true };
        }

        // Keywords detection
        if (q.match(/^(hi|hello|namaste|namaskar|hey|hii|hiii|heyy|adaab|ram ram|good morning|good evening|suprabhat|shubh sandhya|hello jobo|hi jobo|hey jobo|hello dost|hi dost|namaste bro|hello bro|hey bhai|namaste bhai)\b/i)) acts.add('GREET');
        if (q.match(/^(yes|haan|ha|ji|ok|okay|theek|thik|sahi|bilkul|confirm|done|agree|ji haan|ha bhai|yes bro|yes do|ha do|kar do|yes batao|theek hai|theek batao|haan batao)$/i)) acts.add('CONFIRM');
        if (q.match(/^(no|nahi|na|nhi|cancel|stop|rehne do|mat karo|matlab nahi|chhodo)$/i)) acts.add('NEGATE');
        if (q.match(/^(aur|phir|next|continue|agey|aage|more|batao|aur batao|next batao)$/i)) acts.add('EXTEND');
        if (q.match(/\?$/) || q.match(/^(kya|kaise|kyun|kab|kaha|kahan|kon|kaun|who|what|how|where|when|why)/i)) acts.add('INQUIRE');
        if (q.match(/(thanks|thank you|dhanyawad|shukriya|bahut badhiya|good|nice|great)/i)) acts.add('THANK');
        if (q.match(/(help|madad|support|guide|samjhao|batao kaise)/i)) acts.add('HELP');
        if (q.match(/(galat|wrong|error|problem|issue|nahi chal raha|kaam nahi kar raha|mistake)/i)) acts.add('COMPLAINT');

        // Domains
        if (q.match(/(job|jobs|vacancy|naukri|bharti|recruitment|rojgar|sarkari naukri|government job|data|database|list|form|nikla|active|matching|update|notification)/i)) {
            domains.add('GOVERNMENT_JOBS');
            domains.add('GOVT_JOB');
        }
        if (q.match(/(police|constable|daroga|si|sub inspector|home guard)/i)) { domains.add('POLICE_JOB'); domains.add('GOVERNMENT_JOBS'); }
        if (q.match(/(railway|rrb|rpf|alp|group d|ntpc)/i)) { domains.add('RAILWAY_JOB'); domains.add('GOVERNMENT_JOBS'); }
        if (q.match(/(bank|ibps|sbi|rbi|clerk|po|so)/i)) { domains.add('BANK_JOB'); domains.add('GOVERNMENT_JOBS'); }
        if (q.match(/(army|navy|air force|agniveer|defence|bsf|crpf|cisf|itbp|ssb)/i)) { domains.add('DEFENCE_JOB'); domains.add('GOVERNMENT_JOBS'); }
        if (q.match(/(teacher|teaching|prt|tgt|pgt|lecturer|professor|assistant professor)/i)) { domains.add('TEACHING_JOB'); domains.add('GOVERNMENT_JOBS'); }
        if (q.match(/(anganwadi|asha|anm|staff nurse|nurse|nursing|medical|health department)/i)) { domains.add('HEALTH_JOB'); domains.add('GOVERNMENT_JOBS'); }
        if (q.match(/(scholarship|wazifa|stipend|chatravriti|छात्रवृत्ति)/i)) domains.add('SCHOLARSHIP');
        if (q.match(/(career|future|guidance|aim|goal|path|direction|kya karu|career option|doctor|mbbs|nursing|bams|bhms|medical|police kaise bane|teacher kaise bane|engineer kaise bane|12th ke baad)/i)) domains.add('CAREER');

        // Job Intents
        if (q.match(/(latest|new|nayi|नई|upcoming|aane wali|recent|fresh|update|notification)/i) && q.match(/(job|vacancy|bharti|recruitment|naukri)/i)) intents.add('FIND_LATEST_JOBS');
        if (q.match(/(apply|online form|registration|form bhar|awedan|aavedan|apply online|link)/i)) intents.add('APPLY_ONLINE');
        if (q.match(/(last date|lastdate| अंतिम तिथि|aakhri date|last kab|kab tak|closing date|form ki date)/i)) intents.add('CHECK_LAST_DATE');
        if (q.match(/(eligibility|yogyata|qualification|educational qualification|kaun bhar sakta|eligible|पात्रता)/i)) intents.add('CHECK_ELIGIBILITY');
        if (q.match(/(age limit|age|umar|aayu|minimum age|maximum age|age relaxation|छूट)/i)) intents.add('CHECK_AGE_LIMIT');
        if (q.match(/(fee|fees|application fee|exam fee|payment|charge|shulk|फीस)/i)) intents.add('CHECK_FEE');
        if (q.match(/(salary|pay scale|payscale|vetan|वेतन|grade pay|stipend)/i)) intents.add('CHECK_SALARY');
        if (q.match(/(syllabus|pathyakram|exam pattern|pattern|subjects|topic|पाठ्यक्रम)/i)) intents.add('CHECK_SYLLABUS');
        if (q.match(/(admit card|hall ticket|call letter| प्रवेश पत्र)/i)) intents.add('CHECK_ADMIT_CARD');
        if (q.match(/(result|merit list|score card|cut off|cutoff|answer key|परिणाम)/i)) intents.add('CHECK_RESULT');
        if (q.match(/(vacancy details|post details|total post|kitni post|seat|seats|category wise|post wise)/i)) intents.add('CHECK_VACANCY_DETAILS');
        if (q.match(/(official website|website|site|portal|official link)/i)) intents.add('GET_OFFICIAL_WEBSITE');
        if (q.match(/(10th|high school|12th|intermediate|graduate|graduation|iti|diploma|btech|degree|pg|post graduate)/i)) intents.add('FILTER_BY_QUALIFICATION');

        return {
            acts: acts.size > 0 ? Array.from(acts) : ['INFORM'],
            domains: domains.size > 0 ? Array.from(domains) : ['GENERAL'],
            intents: intents.size > 0 ? Array.from(intents) : ['GENERAL_QUERY']
        };
    }
}

module.exports = RuleDetector;
