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
        // Remove noise
        $('script, style, nav, footer, header').remove();

        // Ensure all block elements have trailing spaces to prevent word merging
        $('tr, p, div, br, td, th, li, h1, h2, h3, h4, h5, h6').each((i, el) => {
            $(el).append(' ');
        });

        // Use $.text() on the root for wider coverage
        const text = $.text().replace(/\s\s+/g, ' ');

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

        const patterns = [
            new RegExp(`(?:height|unchai|lambai).{0,100}(\\d{3})\\s*cm`, 'i'),
            new RegExp(`(\\d{3})\\s*cm.{0,50}(?:height|unchai|lambai)`, 'i'),
            new RegExp(`height.{0,50}(\\d{3})\\s*cms`, 'i')
        ];

        for (let p of patterns) {
            const match = text.match(p);
            if (match) return parseInt(match[1]);
        }

        return null;
    }

    static _extractEducation(text) {
        // High priority check for Graduation/Degree
        if (/Bachelor Degree|Graduation|Degree|Snatak|B\.A|B\.SC|B\.COM|B\.TECH|B\.E\b/i.test(text)) return 'GRADUATE';

        const levels = [
            { level: 'PHD', regex: /PHD|DOCTORATE|RESEARCH SCHOLAR/i },
            { level: 'POST GRADUATE', regex: /POST GRADUATE|MASTER|PG |M\.SC|M\.A|M\.COM|M\.TECH|MBA/i },
            { level: 'GRADUATE', regex: /GRADUATE|DEGREE|BACHELOR|SNATAK|B\.A|B\.SC|B\.COM|B\.TECH|B\.E\b|B\.ED/i },
            { level: '12TH PASS', regex: /12TH|INTERMEDIATE|10\+2|SECONDARY|INTER\b/i },
            { level: '10TH PASS', regex: /10TH|MATRIC|HIGH SCHOOL|SSC\b/i }
        ];

        for (let entry of levels) {
            if (entry.regex.test(text)) return entry.level;
        }
        return null;
    }
}

module.exports = HtmlScanner;
