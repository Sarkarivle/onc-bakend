/**
 * EliteFormatter Module (Phase 9)
 * Responsibility: Transforming raw AI text into a high-end visual response.
 * Features: Markdown Tables, Bold Highlights, Natural Hinglish Flow.
 */
class EliteFormatter {
    static format(text, meta = {}) {
        let formatted = text;
        const intent = meta.intent || 'GENERAL';

        // 1. Intent-Based Visual Logic
        if (['JOB_QUERY', 'JOB_DETAILS', 'SCHOLARSHIP'].includes(intent)) {
            formatted = this._ensureTables(formatted);
        } else if (intent === 'CAREER_GUIDANCE') {
            formatted = this._ensureRoadmap(formatted);
        } else if (intent === 'RESUME') {
            formatted = this._ensureChecklist(formatted);
        }

        // 2. Common Enhancements
        formatted = this._highlightDatesAndLinks(formatted);
        formatted = this._stripFluff(formatted);
        formatted = this._addPersonalizedClosing(formatted, meta.userProfile);

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
        const feeMatch = text.match(/Fees?:\s*\*\*(.*?)\*\*/i);
        const dateMatch = text.match(/Last Date:\s*\*\*(.*?)\*\*/i);
        const vacancyMatch = text.match(/Vacancy:\s*\*\*(.*?)\*\*/i);

        if (feeMatch || dateMatch || vacancyMatch) {
            const table = `
| Detail | Information |
| :--- | :--- |
| 📅 Last Date | ${dateMatch ? dateMatch[1] : 'Check Official Site'} |
| 💰 Fees | ${feeMatch ? feeMatch[1] : 'As per notification'} |
| 🔢 Vacancy | ${vacancyMatch ? vacancyMatch[1] : 'Check details'} |
`;
            // Remove the old lines and insert the table
            let cleaned = text.replace(/Fees?:\s*\*\*.*?\*\*\s*/gi, '');
            cleaned = cleaned.replace(/Last Date:\s*\*\*.*?\*\*\s*/gi, '');
            cleaned = cleaned.replace(/Vacancy:\s*\*\*.*?\*\*\s*/gi, '');

            return cleaned + "\n" + table;
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

    static _addPersonalizedClosing(text, profile) {
        if (!profile || !profile.qualification) return text;

        // Add a friendly closing if not present
        if (!text.includes('Best of luck') && !text.includes('shubhkamnayein')) {
            const closing = `\n\nBhai, aap ${profile.qualification} pass ho, toh ye aapke liye achha chance hai. All the best! 👍`;
            return text + closing;
        }
        return text;
    }
}

module.exports = EliteFormatter;
