/**
 * EliteFormatter Module (Phase 9)
 * Responsibility: Transforming raw AI text into a high-end visual response.
 * Features: Markdown Tables, Bold Highlights, Natural Hinglish Flow.
 */
class EliteFormatter {
    static format(text, meta = {}) {
        if (!text) return "";
        let formatted = text;
        const intent = String(meta.intent || 'GENERAL').toUpperCase();

        // 1. Core Cleanup (Always first)
        formatted = this._removeStuttering(formatted);

        // 2. Intent-Based Visual Logic
        if (['JOB_QUERY', 'JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'SCHOLARSHIP', 'RESULT_ADMIT_CARD'].includes(intent)) {
            formatted = this._ensureTables(formatted);
        } else if (['CAREER_GUIDANCE', 'SKILLS', 'INTERVIEW'].includes(intent)) {
            formatted = this._ensureRoadmap(formatted);
        } else if (intent === 'RESUME') {
            formatted = this._ensureChecklist(formatted);
        }

        // 3. Common Enhancements
        formatted = this._highlightDatesAndLinks(formatted);
        formatted = this._stripFluff(formatted);
        formatted = this._removeConflictingQualificationClaims(formatted, meta.userProfile);

        // 4. Personalized Closing (ONLY if it's the final output, not during stream buildup)
        if (meta.isFinal) {
            formatted = this._addPersonalizedClosing(formatted, meta.userProfile, intent);
        }

        return formatted.trim();
    }

    /**
     * Career Advice ko ek "Step-by-Step Roadmap" jaisa dikhana.
     */
    static _ensureRoadmap(text) {
        // AI ke steps (1., 2., 3.) ko arrow points (➔) mein badalna
        return text.replace(/^\d+\.\s+/gm, '🚀 Step: ');
    }

    /**
     * Resume guidance ko ek "Checklist" jaisa dikhana.
     */
    static _ensureChecklist(text) {
        return text.replace(/^- /gm, '✅ ');
    }

    /**
     * Converts raw text or messy tables into a clean Elite Card format.
     */
    static _ensureTables(text) {
        // Remove markdown table artifacts (pipes and dashes) that look bad on mobile
        let cleaned = text.replace(/^[|]| [|] |[|]$/gm, '').replace(/^[-\s|]+$/gm, '');

        // Ensure proper spacing and emojis for a "Card Look"
        return cleaned
            .replace(/(Vacancy|Post|seat):/gi, '📋 **Vacancy**:')
            .replace(/(Last Date|अंतिम तिथि):/gi, '📅 **Last Date**:')
            .replace(/(Fees?|paisa):/gi, '💰 **Fees**:')
            .replace(/\n{3,}/g, '\n\n');
    }

    static _highlightDatesAndLinks(text) {
        // Ensure URLs are markdown links if they aren't already
        return text.replace(/(https?:\/\/[^\s]+)/g, (url) => {
            if (url.includes(']') || url.includes(')')) return url;
            return `[Official Link](${url})`;
        });
    }

    static _stripFluff(text) {
        const patterns = [
            /^Aapke liye ye rahi jankari:?\s*/i,
            /^Zaroor, main batata hoon:?\s*/i,
            /^Niche di gayi details dekhein:?\s*/i
        ];
        let cleaned = text;
        patterns.forEach(p => { cleaned = cleaned.replace(p, ''); });
        return cleaned;
    }

    /**
     * Fixes LLM stuttering/looping issues like "jobs jobs" or "Rakesakesakesh".
     */
    static _removeStuttering(text) {
        if (!text) return text;

        // 1. Remove character-level stuttering (e.g., "Sarkariiii", "BPSSSSC")
        let cleaned = text.replace(/(.)\1{2,}/g, '$1');

        // 2. Remove word-level repetition (e.g., "job job", "Date Date")
        cleaned = cleaned.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');

        // 3. Remove syllable/phrase repetition (e.g., "Rakesakesakesh", "Last Date Last Date")
        // We use a non-greedy match to find repeating patterns of 2-10 characters.
        cleaned = cleaned.replace(/(.{2,10}?)\1{2,}/gi, '$1');

        // 4. Handle "Partial Word" stuttering (e.g., "mad madad madad")
        // Logic: If a word is a prefix/suffix of the next word and they repeat.
        cleaned = cleaned.replace(/\b(\w{2,})\s+(?=\w*\1\w*)/gi, (match, p1) => {
            // If the next word contains this word as a substring, skip this word.
            return "";
        });

        // 5. Remove emoji/punctuation repetition (e.g., "💰💰💰", "!!!")
        cleaned = cleaned.replace(/([\u{1F300}-\u{1F9FF}!.?])\1+/gu, '$1');

        return cleaned;
    }

    static _addPersonalizedClosing(text, profile, intent) {
        if (!profile || !profile.qualification) return text;
        if (!['JOB_QUERY', 'JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'DISCOVERY'].includes(intent)) return text;

        // Add a friendly closing if not present
        if (!text.includes('Best of luck') && !text.includes('shubhkamnayein')) {
            const closing = `\n\nBhai, aap ${profile.qualification} pass ho, toh ye aapke liye achha chance hai. All the best! 👍`;
            return text + closing;
        }
        return text;
    }

    static _removeConflictingQualificationClaims(text, profile) {
        if (!profile || !profile.qualification) return text;

        const qualification = String(profile.qualification).toLowerCase();
        const profileIs12th = /\b12th\b|\b12वीं\b|\bbarahvi\b|\bintermediate\b/i.test(qualification);
        if (profileIs12th) return text;

        // If the current profile says Graduate/B.Tech/etc., remove stale memory
        // claims like "aap 12th pass ho" that may have come from old chat state.
        return text
            .split('\n')
            .filter(line => !/\baap\s+(12th|12वीं|barahvi|intermediate)\s*(pass)?\s*(ho|hai|hain)?\b/i.test(line))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}

module.exports = EliteFormatter;
