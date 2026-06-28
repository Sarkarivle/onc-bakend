/**
 * IntentDetector Module
 * Enterprise Act / Domain / Job Intent Separation
 */

class IntentDetector {
    static detect(query = "") {
        const q = query.toLowerCase().trim();

        const acts = new Set();
        const domains = new Set();
        const intents = new Set();

        // Empty or invalid query
        if (!q) {
            return {
                acts: ['EMPTY'],
                domains: ['GENERAL'],
                intents: ['NO_INPUT']
            };
        }

        // -------------------------------
        // 1. Conversational Acts
        // User ka communication style
        // -------------------------------

        if (q.match(/^(hi|hello|namaste|namaskar|hey|hii|hiii|heyy|adaab|ram ram|good morning|good evening|suprabhat|shubh sandhya|hello jobo|hi jobo)$/i)) {
            acts.add('GREET');
        }

        if (q.match(/^(yes|haan|ha|ji|ok|okay|theek|thik|sahi|bilkul|confirm|done|agree|ji haan|ha bhai|yes bro)$/i)) {
            acts.add('CONFIRM');
        }

        if (q.match(/^(no|nahi|na|nhi|cancel|stop|rehne do|mat karo|matlab nahi|chhodo)$/i)) {
            acts.add('NEGATE');
        }

        if (q.match(/^(aur|phir|next|continue|agey|aage|more|batao|aur batao|next batao)$/i)) {
            acts.add('EXTEND');
        }

        if (q.match(/\?$/) || q.match(/^(kya|kaise|kyun|kab|kaha|kahan|kon|kaun|who|what|how|where|when|why)/i)) {
            acts.add('INQUIRE');
        }

        if (q.match(/(thanks|thank you|dhanyawad|shukriya|bahut badhiya|good|nice|great)/i)) {
            acts.add('THANK');
        }

        if (q.match(/(help|madad|support|guide|samjhao|batao kaise)/i)) {
            acts.add('HELP');
        }

        if (q.match(/(galat|wrong|error|problem|issue|nahi chal raha|kaam nahi kar raha|mistake)/i)) {
            acts.add('COMPLAINT');
        }

        // -------------------------------
        // 2. Domains
        // User kis topic par baat kar raha hai
        // -------------------------------

        if (q.match(/(job|jobs|vacancy|naukri|bharti|recruitment|rojgar|sarkari naukri|government job)/i)) {
            domains.add('GOVT_JOB');
        }

        if (q.match(/(ssc|upsc|bpsc|uppsc|mppsc|rpsc|ctet|uptet|neet|jee|cuet|gate)/i)) {
            domains.add('EXAM');
        }

        if (q.match(/(police|constable|daroga|si|sub inspector|home guard)/i)) {
            domains.add('POLICE_JOB');
        }

        if (q.match(/(railway|rrb|rpf|alp|group d|ntpc)/i)) {
            domains.add('RAILWAY_JOB');
        }

        if (q.match(/(bank|ibps|sbi|rbi|clerk|po|so)/i)) {
            domains.add('BANK_JOB');
        }

        if (q.match(/(army|navy|air force|agniveer|defence|bsf|crpf|cisf|itbp|ssb)/i)) {
            domains.add('DEFENCE_JOB');
        }

        if (q.match(/(teacher|teaching|prt|tgt|pgt|lecturer|professor|assistant professor)/i)) {
            domains.add('TEACHING_JOB');
        }

        if (q.match(/(anganwadi|asha|anm|staff nurse|nurse|medical|health department)/i)) {
            domains.add('HEALTH_JOB');
        }

        if (q.match(/(scholarship|wazifa|stipend|chatravriti|छात्रवृत्ति)/i)) {
            domains.add('SCHOLARSHIP');
        }

        if (q.match(/(college|university|admission|campus|course|degree|diploma)/i)) {
            domains.add('COLLEGE');
        }

        if (q.match(/(resume|cv|biodata|portfolio)/i)) {
            domains.add('RESUME');
        }

        if (q.match(/(career|future|guidance|aim|goal|path|direction|kya karu|career option)/i)) {
            domains.add('CAREER');
        }

        if (q.match(/(math|calculate|hisab|plus|minus|total|percentage|percent|age calculate)/i)) {
            domains.add('COMPUTATION');
        }

        // -------------------------------
        // 3. Job / Exam Specific Intents
        // User actually kya chah raha hai
        // -------------------------------

        if (q.match(/(latest|new|nayi|नई|upcoming|aane wali|recent|fresh)/i) && q.match(/(job|vacancy|bharti|recruitment|naukri)/i)) {
            intents.add('FIND_LATEST_JOBS');
        }

        if (q.match(/(apply|online form|registration|form bhar|awedan|aavedan|apply online|link)/i)) {
            intents.add('APPLY_ONLINE');
        }

        if (q.match(/(last date|lastdate| अंतिम तिथि|aakhri date|last kab|kab tak|closing date|form ki date)/i)) {
            intents.add('CHECK_LAST_DATE');
        }

        if (q.match(/(important date|date|exam date|form date|notification date|admit card date)/i)) {
            intents.add('CHECK_DATES');
        }

        if (q.match(/(eligibility|yogyata|qualification|educational qualification|kaun bhar sakta|eligible|पात्रता)/i)) {
            intents.add('CHECK_ELIGIBILITY');
        }

        if (q.match(/(age limit|age|umar|aayu|minimum age|maximum age|age relaxation|छूट)/i)) {
            intents.add('CHECK_AGE_LIMIT');
        }

        if (q.match(/(fee|fees|application fee|exam fee|payment|charge|shulk|फीस)/i)) {
            intents.add('CHECK_FEE');
        }

        if (q.match(/(salary|pay scale|payscale|vetan|वेतन|grade pay|stipend)/i)) {
            intents.add('CHECK_SALARY');
        }

        if (q.match(/(syllabus|pathyakram|exam pattern|pattern|subjects|topic|पाठ्यक्रम)/i)) {
            intents.add('CHECK_SYLLABUS');
        }

        if (q.match(/(selection process|selection|chayan prakriya|चयन|written test|physical|document verification|dv|medical)/i)) {
            intents.add('CHECK_SELECTION_PROCESS');
        }

        if (q.match(/(admit card|hall ticket|call letter| प्रवेश पत्र)/i)) {
            intents.add('CHECK_ADMIT_CARD');
        }

        if (q.match(/(result|merit list|score card|cut off|cutoff|answer key|परिणाम)/i)) {
            intents.add('CHECK_RESULT');
        }

        if (q.match(/(vacancy details|post details|total post|kitni post|seat|seats|category wise|post wise)/i)) {
            intents.add('CHECK_VACANCY_DETAILS');
        }

        if (q.match(/(document|documents|doc|certificate|photo|signature|required documents|जरूरी दस्तावेज)/i)) {
            intents.add('CHECK_DOCUMENTS');
        }

        if (q.match(/(download notification|notification pdf|advertisement|vigyapan|pdf|official notice)/i)) {
            intents.add('DOWNLOAD_NOTIFICATION');
        }

        if (q.match(/(official website|website|site|portal|official link)/i)) {
            intents.add('GET_OFFICIAL_WEBSITE');
        }

        if (q.match(/(state|rajya|up|bihar|mp|rajasthan|delhi|haryana|jharkhand|chhattisgarh|maharashtra|gujarat|uttarakhand)/i)) {
            intents.add('FILTER_BY_STATE');
        }

        if (q.match(/(10th|high school|12th|intermediate|graduate|graduation|iti|diploma|btech|degree|pg|post graduate)/i)) {
            intents.add('FILTER_BY_QUALIFICATION');
        }

        if (q.match(/(female|mahila|ladki|girls|woman|women|पुरुष|male|ladka)/i)) {
            intents.add('FILTER_BY_GENDER');
        }

        if (q.match(/(general|obc|sc|st|ews|category|reservation)/i)) {
            intents.add('FILTER_BY_CATEGORY');
        }

        // -------------------------------
        // 4. Content Creation Intent
        // Sarkari Result type HTML/article
        // -------------------------------

        if (q.match(/(html|template|article|post|content|notification page|job post|sarkari result style|copy box)/i)) {
            intents.add('CREATE_CONTENT');
        }

        if (q.match(/(rewrite|sahi karo|correct karo|improve|better banao|short karo|simple karo)/i)) {
            intents.add('REWRITE_CONTENT');
        }

        if (q.match(/(table|important dates table|fee table|age table|vacancy table)/i)) {
            intents.add('CREATE_TABLE');
        }

        // -------------------------------
        // 5. Small Talk Intent
        // -------------------------------

        if (acts.has('GREET') && domains.size === 0) {
            intents.add('SMALL_TALK_GREETING');
        }

        if (acts.has('CONFIRM') && domains.size === 0) {
            intents.add('USER_CONFIRMED');
        }

        if (acts.has('NEGATE') && domains.size === 0) {
            intents.add('USER_REJECTED');
        }

        if (acts.has('EXTEND') && domains.size === 0) {
            intents.add('CONTINUE_PREVIOUS_TOPIC');
        }

        // -------------------------------
        // Final Output
        // -------------------------------

        return {
            acts: acts.size > 0 ? Array.from(acts) : ['INFORM'],
            domains: domains.size > 0 ? Array.from(domains) : ['GENERAL'],
            intents: intents.size > 0 ? Array.from(intents) : ['GENERAL_QUERY']
        };
    }
}

module.exports = IntentDetector;
