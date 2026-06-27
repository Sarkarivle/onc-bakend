/**
 * IntentDetector Module (Enterprise Act/Domain Separation)
 */
class IntentDetector {
    static detect(query) {
        const q = query.toLowerCase().trim();
        const acts = new Set();
        const domains = new Set();

        // 1. Conversational Acts (How is the user communicating?)
        if (q.match(/^(hi|hello|namaste|hey|adaab|hii|hiii|heyy|kaise ho|suprabhat|shubh sandhya|good morning|good evening|hello jobo|hi jobo)$/i)) acts.add('GREET');
        if (q.match(/^(yes|haan|ha|ji|ok|theek|sahi|bilkul|confirm|done|agree|ji haan)$/i)) acts.add('CONFIRM');
        if (q.match(/^(no|nahi|na|cancel|stop|rehne do|matlab nahi|nhi)$/i)) acts.add('NEGATE');
        if (q.match(/^(aur|phir|next|continue|agey|more|batao)$/i)) acts.add('EXTEND');
        if (q.match(/\?$/) || q.match(/^(kya|kaise|kyun|kab|who|what|how|where)/i)) acts.add('INQUIRE');

        // 2. Domain Subjects (What is the user talking about?)
        if (q.match(/(job|vacancy|naukri|bharti|ssc|upsc|police|bank|gd|railway|army)/i)) domains.add('GOVT_JOB');
        if (q.match(/(career|future|guidance|aim|goal|path|direction)/i)) domains.add('CAREER');
        if (q.match(/(resume|cv|biodata|portfolio)/i)) domains.add('RESUME');
        if (q.match(/(scholarship|wazifa|stipend|chatravriti)/i)) domains.add('SCHOLARSHIP');
        if (q.match(/(college|university|admission|campus)/i)) domains.add('COLLEGE');
        if (q.match(/(interview|sakshatkar|mock)/i)) domains.add('INTERVIEW');
        if (q.match(/(math|calculate|hisab|plus|minus|total)/i)) domains.add('COMPUTATION');

        return {
            acts: Array.from(acts).length > 0 ? Array.from(acts) : ['INFORM'],
            domains: Array.from(domains).length > 0 ? Array.from(domains) : ['GENERAL']
        };
    }
}

module.exports = IntentDetector;
