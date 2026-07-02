/**
 * EliteFormatter Module (Phase 9)
 * Responsibility: Transforming raw AI text into a high-end visual response.
 * Features: Markdown Tables, Bold Highlights, Natural Hinglish Flow.
 */
class EliteFormatter {
    static format(text, meta = {}) {
        let formatted = text;
        const intent = String(meta.intent || 'GENERAL').toUpperCase();

        // 1. Intent-Based Visual Logic
        if (['JOB_QUERY', 'JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'SCHOLARSHIP', 'RESULT_ADMIT_CARD'].includes(intent)) {
            formatted = this._ensureTables(formatted);
        } else if (['CAREER_GUIDANCE', 'SKILLS', 'INTERVIEW'].includes(intent)) {
            formatted = this._ensureRoadmap(formatted);
        } else if (intent === 'RESUME') {
            formatted = this._ensureChecklist(formatted);
        }

        // 2. Common Enhancements
        formatted = this._highlightDatesAndLinks(formatted);
        formatted = this._stripFluff(formatted);
        formatted = this._removeConflictingQualificationClaims(formatted, meta.userProfile);
        formatted = this._addPersonalizedClosing(formatted, meta.userProfile, intent);

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
     * Converts bullet-point job facts into a clean Markdown Table.
     */
    static _ensureTables(text) {
        // If text already has a table, just fix spacing
        if (text.includes('|') && text.includes('---')) {
            return text.replace(/\n\|/g, '\n\n|');
        }

        // Search for patterns like "Fees: **100**", "Last Date: **20 July**"
        // Also handling cases where labels are bolded: "**Last Date**: 15 July"
        const feeMatch = text.match(/(?:Fees?|paisa):\s*\*\*(.*?)\*\*/i) || text.match(/\*\*(?:Fees?|paisa)\*\*:\s*(.*?)(?:\n|$)/i);
        const dateMatch = text.match(/(?:Last Date|अंतिम तिथि):\s*\*\*(.*?)\*\*/i) || text.match(/\*\*(?:Last Date|अंतिम तिथि)\*\*:\s*(.*?)(?:\n|$)/i);
        const vacancyMatch = text.match(/(?:Vacancy|Post|seat):\s*\*\*(.*?)\*\*/i) || text.match(/\*\*(?:Vacancy|Post|seat)\*\*:\s*(.*?)(?:\n|$)/i);

        if (feeMatch || dateMatch || vacancyMatch) {
            const table = `
| Detail | Information |
| :--- | :--- |
| 📋 **Vacancy** | **${vacancyMatch ? vacancyMatch[1].trim() : 'Check details'}** |
| 📅 **Last Date** | **${dateMatch ? dateMatch[1].trim() : 'Check Official Site'}** |
| 💰 **Fees** | **${feeMatch ? feeMatch[1].trim() : 'As per notification'}** |
`;
            // Remove the old lines/sentences that contained these facts to avoid duplication
            let cleaned = text;
            if (dateMatch) cleaned = cleaned.replace(/.*Last Date.*/gi, '').replace(/.*अंतिम तिथि.*/gi, '');
            if (feeMatch) cleaned = cleaned.replace(/.*Fees?.*/gi, '').replace(/.*paisa.*/gi, '');
            if (vacancyMatch) cleaned = cleaned.replace(/.*Vacancy.*/gi, '').replace(/.*Post.*/gi, '');

            return cleaned.trim() + "\n" + table;
        }

        return text;
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
