const cheerio = require('cheerio');

/**
 * HtmlScanner Utility
 * Responsibility: Extracting missing eligibility rules directly from the job's HTML content.
 */
class HtmlScanner {
    /**
     * Attempts to find a value for a specific rule type in HTML
     */
    static scan(html, ruleType, userContext = {}) {
        if (!html || html === 'N/A') return null;

        const $ = cheerio.load(html);
        // Remove noise but preserve table spacing
        $('script, style, nav, footer').remove();
        $('tr, p, div, br').append(' '); // Add space to prevent word merging
        const text = $('body').text().replace(/\s\s+/g, ' ');

        switch (ruleType) {
            case 'HEIGHT':
                return this._extractHeight(text, userContext.gender);
            case 'EDUCATION':
                return this._extractEducation(text);
            default:
                return null;
        }
    }

    static _extractHeight(text, gender = 'MALE') {
        const isFemale = String(gender).toUpperCase() === 'FEMALE';

        // Pattern: Look for "Height", then some characters, then 3 digits + cm/cms
        // Example: "Height for General/OBC candidates is 165 cms"
        const patterns = [
            new RegExp(`(?:height|unchai|lambai).{0,100}(\\d{3})\\s*cm`, 'i'),
            new RegExp(`(\\d{3})\\s*cm.{0,50}(?:height|unchai|lambai)`, 'i')
        ];

        for (let p of patterns) {
            const match = text.match(p);
            if (match) return parseInt(match[1]);
        }

        return null;
    }

    static _extractEducation(text) {
        const levels = {
            'PHD': /PHD|DOCTORATE|RESEARCH SCHOLAR/i,
            'POST GRADUATE': /POST GRADUATE|MASTER|PG |M\.SC|M\.A|M\.COM|M\.TECH|MBA/i,
            'GRADUATE': /GRADUATE|DEGREE|BACHELOR|SNATAK|B\.A|B\.SC|B\.COM|B\.TECH|B\.E\b/i,
            '12TH PASS': /12TH|INTERMEDIATE|10\+2|SECONDARY|INTER\b/i,
            '10TH PASS': /10TH|MATRIC|HIGH SCHOOL|SSC\b/i
        };

        for (let [level, regex] of Object.entries(levels)) {
            if (regex.test(text)) return level;
        }
        return null;
    }
}

module.exports = HtmlScanner;
