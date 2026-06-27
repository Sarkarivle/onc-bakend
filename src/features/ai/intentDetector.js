class IntentDetector {
    /**
     * Identifies which prompt modules are needed for the current request.
     * Production Ready: Supports Multi-Intent Detection as per Rule 4.
     */
    static detect(query) {
        const q = query.toLowerCase();

        // Rule 1: Always include core logic modules for consistency
        // Production Standard: Added Quality & Reasoning modules
        const intents = new Set([
            'CORE',
            'LEARNING',
            'INTELLIGENCE',
            'EXECUTION',
            'OUTPUT',
            'PERSONALITY',
            'LANGUAGE',
            'REASONING',
            'VALIDATOR',
            'FORMATTER',
            'SEARCH_DECISION',
            'HALLUCINATION_PREVENTION',
            'CORRECTION_ENGINE',
            'ANALYTICS'
        ]);

        // Intent Mapping Patterns
        const patterns = {
            'GREETING': /(hi|hello|namaste|hey|adaab|salam|kaise ho|suprabhat|good morning)/i,
            'GOODBYE': /(bye|alvida|phir milte hai|good night|tata|shubhratri)/i,
            'THANKS': /(thanks|shukriya|dhanyawad|thank you|meherbani)/i,
            'SMALL_TALK': /(aur batao|kya hal hai|kya kar rahe ho|thik ho)/i,
            'GOVT_JOB': /(job|vacancy|naukri|bharti|ssc|upsc|police|army|railway|bank|gd|cgl|chsl|mts|daroga|constable)/i,
            'PRIVATE_JOB': /(private job|it job|delivery boy|helper|guard|receptionist|peon|driver|packing)/i,
            'LATEST_VACANCY': /(new vacancy|latest job|nayi bharti|current opening)/i,
            'EXAM': /(exam|paper|pariksha|test|viva)/i,
            'ELIGIBILITY': /(eligibility|qualification|yogyata|kaun bhar sakta hai|10th pass|12th pass|graduate|degree|diploma)/i,
            'AGE_LIMIT': /(age|umra|aayu|age limit|kitne saal|maximum age|minimum age)/i,
            'SALARY': /(salary|paisa|vetan|monthly|income|pay scale|per month)/i,
            'SELECTION_PROCESS': /(selection|process|chayan|kaise hoga|exam stage|interview stage)/i,
            'EXAM_PATTERN': /(pattern|syllabus|vishay|subjects|marks|negative marking)/i,
            'BOOKS': /(book|kitab|notes|pdf|best book|resource|pustak)/i,
            'PREPARATION': /(preparation|taiyari|kaise karein|strategy|study plan)/i,
            'RESULT': /(result|parinam|nateeja|score card)/i,
            'ANSWER_KEY': /(answer key|uttar kunji|solutions)/i,
            'ADMIT_CARD': /(admit card|hall ticket|entry card|call letter)/i,
            'SCHOLARSHIP': /(scholarship|wazifa|chatravriti|stipend)/i,
            'CAREER': /(career|career guidance|kya karein|direction|future)/i,
            'COLLEGE': /(college|university|admission|school|campus)/i,
            'RESUME': /(resume|cv|biodata|portfolio)/i,
            'INTERVIEW': /(interview|sakshatkar|mock interview)/i,
            'SKILLS': /(skills|hunnar|seekhna|course|training)/i,
            'MOTIVATION': /(motivation|motivate|himmat|shayari|suvichar|inspiration)/i,
            'NEWS': /(news|khabar|samachar|update|khabrein)/i,
            'FEEDBACK': /(feedback|suggestion|complaint|shikayat)/i,
            'BUG_REPORT': /(error|bug|issue|kaam nahi kar raha|not working)/i,
            'STUDENT_GUIDANCE': /(study|padhai|timetable|schedule|exam stress|subjects|ncert|notes)/i
        };

        // Detect all matching intents
        for (const [intent, pattern] of Object.entries(patterns)) {
            if (q.match(pattern)) {
                intents.add(intent);
            }
        }

        // Mapping multi-patterns to single modules for Registry optimization
        if (intents.has('EXAM') || intents.has('PREPARATION') || intents.has('BOOKS') || intents.has('STUDENT_GUIDANCE')) {
            intents.add('STUDENT_GUIDANCE');
        }

        // Backward Compatibility for SEARCH logic
        // If query is about jobs or latest news, ensure SEARCH module is included
        if (intents.has('GOVT_JOB') || intents.has('PRIVATE_JOB') || intents.has('LATEST_VACANCY') || intents.has('NEWS')) {
            intents.add('SEARCH');
        }

        // Final fallback
        if (intents.size <= 7) {
            intents.add('GENERAL_QUESTION');
        }

        return Array.from(intents);
    }
}

module.exports = IntentDetector;
