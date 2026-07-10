const BaseRule = require('./BaseRule');
const HtmlScanner = require('../utils/HtmlScanner');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints, jobContext = {}) {
        const firstName = user.name?.split(' ')[0] || "Dost";
        const hierarchy = { '8TH PASS': 0, '10TH PASS': 1, '12TH PASS': 2, 'ITI/DIPLOMA': 2, 'GRADUATE': 3, 'POST GRADUATE': 4, 'PHD': 5 };

        // 1. DATA RESOLUTION (Priority: base_constraints -> structured_data -> HTML)
        let eduReq = constraints.education || {};
        let fd = jobContext.fullData || {};

        if (typeof fd === 'string') {
            try { fd = JSON.parse(fd); } catch (e) { fd = {}; }
        }

        // 2. INTELLIGENT SEARCH
        let foundLevel = null;

        // Only accept levels that match our hierarchy
        const validate = (lvl) => {
            const normalized = this._normalizeLevelName(String(lvl || "").toUpperCase());
            return hierarchy[normalized] !== undefined ? normalized : null;
        };

        const possiblePaths = [
            fd.rule_map?.education?.level,
            fd.structured_data?.eligibility?.education,
            fd.eligibility?.education,
            fd.eligibility?.qualification,
            constraints.education?.level
        ];

        for (const path of possiblePaths) {
            if (path && path !== 'N/A') {
                const valid = validate(path);
                if (valid) {
                    foundLevel = valid;
                    break;
                }
            }
        }

        // 3. HTML SCAN (If structured data doesn't have a CLEAR education level)
        if (!foundLevel && jobContext.fullHtmlContent) {
            const extracted = HtmlScanner.scan(jobContext.fullHtmlContent, 'EDUCATION');
            if (extracted) foundLevel = validate(extracted);
        }

        // 4. SI/DAROGA SPECIAL CASE (Mandatory Graduate)
        if (!foundLevel) {
            const title = String(jobContext.title || fd.structured_data?.title || "").toUpperCase();
            if (title.includes('SUB INSPECTOR') || title.includes(' SI ') || title.includes('DAROGA')) {
                foundLevel = 'GRADUATE';
            }
        }

        // GATEKEEPER: If we really can't find anything
        if (!foundLevel) {
            return {
                module: this.module,
                status: 'PASS',
                message: `Bhai ${firstName}, is job me koi khaas education level mentioned nahi hai.`,
                score: 100
            };
        }

        const userLevelRaw = (user.education || user.educationLevel || user.qualification || "").toUpperCase();
        const userLevel = this._normalizeLevelName(userLevelRaw);

        // 5. CHECK IF USER DATA IS MISSING
        if (!userLevel || userLevel === 'N/A') {
            return {
                module: this.module,
                status: 'INCOMPLETE',
                message: `Bhai ${firstName}, aapne apni padhai ki detail (10th/12th/Grad) nahi bhari hai. Profile update karein.`,
                score: 0,
                field: 'education'
            };
        }

        const userScore = hierarchy[userLevel] !== undefined ? hierarchy[userLevel] : -1;
        const reqScore = hierarchy[foundLevel];

        // 6. STRICT ACADEMIC HIERARCHY CHECK
        if (reqScore > 0 && userScore < reqScore) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Education Mismatch: Bhai ${firstName}, isme ${foundLevel} manga hai, par aapne ${userLevel} kiya hai.`,
                score: 0,
                requirement: foundLevel,
                userHad: userLevel
            };
        }

        return {
            module: this.module,
            status: 'PASS',
            message: `Perfect Match: Bhai ${firstName}, aapki qualification (${userLevel}) is job ke liye sahi hai!`,
            score: 100,
            requirement: foundLevel,
            userHad: userLevel
        };
    }

    _normalizeLevelName(text) {
        const t = String(text || "").toUpperCase();
        if (t.includes('PHD')) return 'PHD';
        if (t.includes('POST GRADUATE') || t.includes('PG ') || t.includes('MASTER')) return 'POST GRADUATE';
        if (t.includes('GRADUATE') || t.includes('DEGREE') || t.includes('BACHELOR') || t.includes('SNATAK') || t.includes('B.A') || t.includes('B.SC') || t.includes('B.COM') || t.includes('B.TECH') || t.includes('B.E')) return 'GRADUATE';
        if (t.includes('12TH') || t.includes('INTERMEDIATE') || t.includes('10+2') || t.includes('HSC') || t.includes('INTER ')) return '12TH PASS';
        if (t.includes('10TH') || t.includes('MATRIC') || t.includes('SSC') || t.includes('HIGH SCHOOL')) return '10TH PASS';
        if (t.includes('8TH')) return '8TH PASS';
        return t;
    }
}

module.exports = EducationRule;
