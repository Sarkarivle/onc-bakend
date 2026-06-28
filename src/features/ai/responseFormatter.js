/**
 * ResponseFormatter Module
 * Responsibility: Final polish of AI responses, Pro Tip validation, and structure enforcement.
 */
class ResponseFormatter {
    /**
     * @param {string} text - Cleaned text.
     * @param {Object} meta - { intent, userProfile, query }
     */
    static format(text, meta = {}) {
        let formatted = text;

        // 1. Pro Tip Validation
        formatted = this._validateProTip(formatted, meta);

        // 2. CTA Validation
        formatted = this._validateCTA(formatted, meta);

        // 3. Formatting Rules
        // Ensure bold exam names/dates (Simple regex fixes)
        formatted = formatted.replace(/^(\s*-?\s*(Vacancy|Last Date|Official Link):\s*)(?!\*\*)(.+)$/gim, (match, prefix, _label, value) => {
            const cleanValue = value.trim();
            if (!cleanValue || cleanValue.startsWith('**')) return match;
            return `${prefix}**${cleanValue.replace(/\*\*$/g, '')}**`;
        });

        // 4. Eligibility Stripping for job lists (if not asked)
        const jobIntents = ['GOVT_JOB', 'JOB_QUERY', 'MORE_JOBS', 'MORE_RESULTS', 'FIELD_DETAILS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'JOB_LINK_DETAILS', 'APPLICATION_HELP', 'EXAM', 'POLICE_JOB', 'RAILWAY_JOB', 'BANK_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB'];
        const asksEligibility = /(eligibility|yogyata|qualification|educational qualification|kaun bhar sakta|eligible|पात्रता)/i.test(meta.query || "");
        if (jobIntents.includes(meta.intent) && !asksEligibility) {
            formatted = this._stripEligibilityLines(formatted);
        }

        return formatted.trim();
    }

    static _validateProTip(text, { userProfile, intent }) {
        if (!text.includes('Pro Tip:')) return text;

        const lines = text.split('\n');
        const proTipIndex = lines.findIndex(l => l.includes('Pro Tip:'));
        let proTip = lines[proTipIndex];

        // 1. Sentence count & length
        const content = proTip.replace(/Pro Tip:\s*/i, '').trim();
        const words = content.split(/\s+/);

        // If more than 22 words or multiple sentences, shorten it.
        if (words.length > 22 || content.includes('.')) {
            // Pick a safe personalized or context-aware tip
            if (userProfile?.category === 'OBC' || userProfile?.category === 'SC' || userProfile?.category === 'ST') {
                proTip = "Pro Tip: Fee pay karne se pehle category-wise fee aur relaxation zaroor check karein.";
            } else if (userProfile?.dob) {
                proTip = "Pro Tip: Form bharne se pehle cutoff date ke anusaar apni age eligibility verify karein.";
            } else {
                proTip = "Pro Tip: Form bharne se pehle photo, signature, ID proof aur certificates ready rakhein.";
            }
            lines[proTipIndex] = proTip;
        }

        return lines.join('\n');
    }

    static _validateCTA(text, { intent, isPureGreeting }) {
        // If pure greeting, ensure specific CTA
        if (isPureGreeting) {
            if (!text.match(/(madad karun|poochna chahte hain|help karta hoon)/i)) {
                return text + "\n\nAap bataiye, main kis cheez me madad karun?";
            }
        }

        // Remove forced "Please respond with one of the following"
        return text.replace(/Please respond with one of the following[:.]?\s*/gi, '');
    }

    static _stripEligibilityLines(message) {
        const lines = message.split('\n');
        const cleaned = [];
        let skippingEligibility = false;
        const eligibilityStart = /^\s*-?\s*(eligibility|eligiblity|qualification|educational qualification|education requirement|age limit)\s*:/i;
        const nextAllowedLine = /^\s*(\d+\.\s+|-+\s*(vacancy|last date|official link|apply link)\s*:|pro tip\s*:|kaunsi\b|kya\b|apply se\b)/i;

        for (const line of lines) {
            if (eligibilityStart.test(line)) {
                skippingEligibility = true;
                continue;
            }

            if (skippingEligibility) {
                if (!line.trim()) {
                    skippingEligibility = false;
                    cleaned.push(line);
                    continue;
                }
                if (!nextAllowedLine.test(line)) continue;
                skippingEligibility = false;
            }
            cleaned.push(line);
        }
        return cleaned.join('\n');
    }
}

module.exports = ResponseFormatter;
