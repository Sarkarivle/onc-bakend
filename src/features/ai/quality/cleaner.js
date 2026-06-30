/**
 * Cleaner Module (Formerly ResponseCleaner)
 * Responsibility: Code-based cleanup of AI responses.
 */
class Cleaner {
    static clean(text, meta = {}) {
        let cleanText = text;

        cleanText = cleanText.replace(/<(HIDDEN_MATH|USER_MESSAGE|think|CALC)>[\s\S]*?<\/\1>/gi, '').trim();
        cleanText = cleanText.replace(/<(?:HIDDEN_MATH|USER_MESSAGE|think|CALC)>/gi, '').replace(/<\/(?:HIDDEN_MATH|USER_MESSAGE|think|CALC)>/gi, '');

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
            /bhai,\s*aage ki taiyari/gi, /bhai,\s*form bharte samay/gi, /bhai,\s*12th ke baad career/gi,
            /abhi 2026 me vacancy aayi hain/gi,
            /\b(JOB_QUERY|MORE_JOBS|JOB_FEE_DETAILS|GOVERNMENT_JOBS|RAILWAY_JOB|BANK_JOB|POLICE_JOB|DEFENCE_JOB|TEACHING_JOB|HEALTH_JOB|CAREER_GUIDANCE|EXPLAIN_LAST_FAILURE|SHOW_FULL_DETAILS|DATABASE_FIRST|PROFILE_AND_LLM)\b/g,
            /career ka sapna[^.\n]*[.\n]?/gi,
            /aaj kal naukriyon[\s\S]*?open hain\??/gi,
            /^\s*job list\s*:?\s*$/gim,
            /user profile is missing/gi, /profile complete nahi hai/gi,
            /aisi aankhon wale sawalon/gi, /gyan hona zaroori hai/gi, /janna chahiye/gi,
            /<span[^>]*>|<\/span>/gi, /<font[^>]*>|<\/font>/gi
        ];

        blacklisted.forEach(reg => { cleanText = cleanText.replace(reg, ''); });

        cleanText = cleanText.replace(/(Vacancy:\s*\*\*.*?\*\*)\s*\n\s*\1/gi, '$1');
        cleanText = cleanText.replace(/(Last Date:\s*\*\*.*?\*\*)\s*\n\s*\1/gi, '$1');
        cleanText = cleanText.replace(/(Official Link:\s*\[.*?\]\(.*?\))\s*\n\s*\1/gi, '$1');

        if (!meta.query?.toLowerCase().match(/(kaun|who|identity|tumhara naam|tum kaun)/)) {
            cleanText = cleanText.replace(/main jobo ai hu[.!]*\s*/gi, '');
            cleanText = cleanText.replace(/main onc ai assistant hoon[.!]*\s*/gi, '');
            cleanText = cleanText.replace(/main aapka career assistant hu[.!]*\s*/gi, '');
        }

        cleanText = this._stripGeminiFluff(cleanText);
        cleanText = this._removeExpiredJobBlocks(cleanText);

        return cleanText.replace(/\n{3,}/g, '\n\n').trim();
    }

    static _stripGeminiFluff(text) {
        const fluffLines = [
            /^Aapke liye ye rahi jankari:?\s*/i,
            /^Aapke liye acchi jobs ki list:?\s*/i,
            /^Main samajh sakta hoon कि आप[^.\n]*[.\n]?/i,
            /^Sarkari naukriyon mein[^.\n]*[.\n]?/i,
            /^Ye rahi details:?\s*/i,
            /^Niche di gayi jankari check karein:?\s*/i,
            /^Main aapki madad kar sakta hoon:?\s*/i,
            /^Zaroor, main aapko batata hoon:?\s*/i,
            /^Ye rahi puri details:?\s*/i
        ];

        let cleaned = text;
        fluffLines.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });

        return cleaned.trim();
    }

    static _removeExpiredJobBlocks(text) {
        const blocks = text.split(/\n(?=\d+\.\s+\*\*)/);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeBlocks = blocks.filter(block => {
            const dateMatch = block.match(/Last Date:\s*\*\*(.*?)\*\*/i);
            if (dateMatch) {
                const dateStr = dateMatch[1].trim();
                const jobDate = new Date(dateStr);
                if (!isNaN(jobDate.getTime()) && jobDate < today) return false;
            }
            return true;
        });

        if (activeBlocks.length === 0 && blocks.length > 0 && text.includes('Last Date:')) {
            return "Abhi apply ke liye koi active verified job nahi mili.";
        }

        return activeBlocks.join('\n');
    }

    static getGreetingFallback() {
        return "Hi! 😊 Main theek hoon. Aap bataiye, main kis cheez me madad karun?";
    }

    static getFactualFallback() {
        return "Maaf kijiye, mujhe abhi iski verified jankari nahi mili hai.";
    }
}

module.exports = Cleaner;
