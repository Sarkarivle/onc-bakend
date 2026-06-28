/**
 * ResponseCleaner Module
 * Responsibility: Code-based cleanup of AI responses to remove leaks, duplicates, and forbidden text.
 */
class ResponseCleaner {
    /**
     * @param {string} text - The AI response.
     * @param {Object} meta - { isPureGreeting, intent, query }
     */
    static clean(text, meta = {}) {
        let cleanText = text;

        // 1. Tag Removal
        cleanText = cleanText.replace(/<(?:HIDDEN_MATH|USER_MESSAGE|think|CALC)>[\s\S]*?<\/\1>/gi, '').trim();
        cleanText = cleanText.replace(/<(?:HIDDEN_MATH|USER_MESSAGE|think|CALC)>/gi, '').replace(/<\/(?:HIDDEN_MATH|USER_MESSAGE|think|CALC)>/gi, '');

        // 2. Remove Forbidden Internal Leakage (Code-based surgical removal)
        const blacklisted = [
            /\[OUTPUT PROTOCOL.*?\]/gi, /\[CRITICAL RULES.*?\]/gi, /\[IDENTITY.*?\]/gi,
            /\[PERSONALITY.*?\]/gi, /\[GUARDRAILS.*?\]/gi, /\[GOVERNMENT JOBS MODULE.*?\]/gi,
            /verified source recommended/gi, /backend rule/gi, /system rule/gi,
            /sarkari naukri ka niyam/gi, /i must not guess/gi, /as per my rule/gi,
            /internal validation/gi, /source recommended/gi, /hallucination guard/gi,
            /sourceverified/gi, /validation failed/gi, /official source recommended/gi,
            /sapni wala data/gi, /aapne yes kaha/gi, /you said yes/gi,
            /namaste!?\s*main jobo ai[^.\n]*[.\n]?/gi,
            /mera niyam hai/gi, /ai rules/gi, /internal logic/gi, /niyam hai/gi,
            /complex topic/gi, /bada ocean/gi, /keyword use kiya hai/gi,
            /aapne sirf/gi, /sirf hi bola/gi, /you only said/gi, /greeting detected/gi,
            /pure greeting/gi, /detected intent/gi, /no domain found/gi, /isliye maine/gi,
            /maine system ki madad se/gi, /system ki madad se/gi,
            /category ki jobs/gi, /jobs me madad/gi, /career aur jobs/gi,
            /\b(JOB_QUERY|MORE_JOBS|JOB_FEE_DETAILS|GOVERNMENT_JOBS|CAREER_GUIDANCE|EXPLAIN_LAST_FAILURE|SHOW_FULL_DETAILS|DATABASE_FIRST|PROFILE_AND_LLM)\b/g,
            /career ka sapna[^.\n]*[.\n]?/gi,
            /aaj kal naukriyon[\s\S]*?open hain\??/gi,
            /^\s*job list\s*:?\s*$/gim,
            /user profile is missing/gi, /profile complete nahi hai/gi,
            /aisi aankhon wale sawalon/gi, /gyan hona zaroori hai/gi, /janna chahiye/gi,
            /<span[^>]*>|<\/span>/gi, /<font[^>]*>|<\/font>/gi
        ];

        blacklisted.forEach(reg => { cleanText = cleanText.replace(reg, ''); });

        // 3. Remove Duplicate Job Fields (Surgical regex)
        // If a block has double Vacancy/Last Date/Official Link, keep only the first one
        cleanText = cleanText.replace(/(Vacancy:\s*\*\*.*?\*\*)\s*\n\s*\1/gi, '$1');
        cleanText = cleanText.replace(/(Last Date:\s*\*\*.*?\*\*)\s*\n\s*\1/gi, '$1');
        cleanText = cleanText.replace(/(Official Link:\s*\[.*?\]\(.*?\))\s*\n\s*\1/gi, '$1');

        // 4. Identity Intro Removal (Unless specifically asked)
        if (!meta.query?.toLowerCase().match(/(kaun|who|identity|tumhara naam|tum kaun)/)) {
            cleanText = cleanText.replace(/main jobo ai hu[.!]*\s*/gi, '');
            cleanText = cleanText.replace(/main onc ai assistant hoon[.!]*\s*/gi, '');
            cleanText = cleanText.replace(/main aapka career assistant hu[.!]*\s*/gi, '');
        }

        // 5. Expired Job Removal (Code-based block removal)
        cleanText = this._removeExpiredJobBlocks(cleanText);

        // 6. Final whitespace cleanup
        cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

        return cleanText;
    }

    /**
     * Removes entire job blocks if the Last Date is in the past.
     */
    static _removeExpiredJobBlocks(text) {
        const blocks = text.split(/\n(?=\d+\.\s+\*\*)/);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeBlocks = blocks.filter(block => {
            const dateMatch = block.match(/Last Date:\s*\*\*(.*?)\*\*/i);
            if (dateMatch) {
                const dateStr = dateMatch[1].trim();
                const jobDate = new Date(dateStr);
                if (!isNaN(jobDate.getTime()) && jobDate < today) {
                    return false; // Remove expired block
                }
            }
            return true;
        });

        if (activeBlocks.length === 0 && blocks.length > 0 && text.includes('Last Date:')) {
            return "Abhi apply ke liye koi active verified job nahi mili.";
        }

        return activeBlocks.join('\n');
    }

    /**
     * Emergency Greeting Fix
     */
    static getGreetingFallback() {
        return "Hi! 😊 Main theek hoon. Aap bataiye, main kis cheez me madad karun?";
    }

    /**
     * Emergency Factual Fallback
     */
    static getFactualFallback() {
        return "Maaf kijiye, mujhe abhi iski verified jankari nahi mili hai.";
    }
}

module.exports = ResponseCleaner;
