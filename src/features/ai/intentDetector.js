class IntentDetector {
    static detect(query) {
        const q = query.toLowerCase();
        const intents = new Set(['CORE', 'IDENTITY', 'SAFETY', 'FORMATTING']); // Always loaded

        if (q.match(/(hi|hello|namaste|hey|morning|evening|kaise ho|hal)/i)) intents.add('GREETING');
        if (q.match(/(job|vacancy|ssc|upsc|police|army|railway|naukri|form|eligibility)/i)) intents.add('GOVT_JOB');
        if (q.match(/(apply|form kaise bharein|registration|link|jansewa|kendra)/i)) intents.add('JANSEWA');

        return Array.from(intents);
    }
}

module.exports = IntentDetector;
