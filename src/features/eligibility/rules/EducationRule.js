const BaseRule = require('./BaseRule');
const HtmlScanner = require('../utils/HtmlScanner');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints, jobContext = {}) {
        const firstName = user.name?.split(' ')[0] || "Dost";
        let eduReq = constraints.education || {};

        // 1. IMPROVED DATA RESOLUTION (No "Jugad", just thorough scanning)
        const fd = jobContext.fullData || {};
        const structuredEdu = fd.eligibility?.education || fd.structured_data?.eligibility?.education;
        const structuredQual = fd.eligibility?.qualification || fd.structured_data?.eligibility?.qualification;

        // If the rule_map from import is weak, we fallback to structured text or HTML
        if (!eduReq.level || eduReq.level === 'N/A' || eduReq.level === '') {
            const rawTextToNormalize = (structuredEdu || structuredQual || "").toUpperCase();
            if (rawTextToNormalize && rawTextToNormalize.length > 2) {
                eduReq = { level: rawTextToNormalize };
            } else if (jobContext.fullHtmlContent) {
                const extracted = HtmlScanner.scan(jobContext.fullHtmlContent, 'EDUCATION');
                if (extracted) eduReq = { level: extracted };
            }
        }

        // 2. FINAL FALLBACK: If still missing, check any text in the job overview
        if (!eduReq.level || eduReq.level === 'N/A') {
            const overview = fd.job_overview || fd.structured_data?.job_overview || {};
            const overviewText = JSON.stringify(overview).toUpperCase();
            if (overviewText.includes('GRADUATE') || overviewText.includes('DEGREE')) {
                eduReq = { level: 'GRADUATE' };
            }
        }

        // GATEKEEPER: If we really can't find anything
        if (!eduReq.level || eduReq.level === 'N/A') {
            return {
                module: this.module,
                status: 'PASS',
                message: `Bhai ${firstName}, is job me koi khaas education level mentioned nahi hai.`,
                score: 100
            };
        }

        const userLevelRaw = (user.education || user.educationLevel || user.qualification || "").toUpperCase();
        const userLevel = this._normalizeLevelName(userLevelRaw);

        // 3. CHECK IF USER DATA IS MISSING
        if (!userLevel || userLevel === 'N/A') {
            return {
                module: this.module,
                status: 'INCOMPLETE',
                message: `Bhai ${firstName}, aapne apni padhai ki detail (10th/12th/Grad) nahi bhari hai. Profile update karein.`,
                score: 0,
                field: 'education'
            };
        }

        const hierarchy = { '8TH PASS': 0, '10TH PASS': 1, '12TH PASS': 2, 'ITI/DIPLOMA': 2, 'GRADUATE': 3, 'POST GRADUATE': 4, 'PHD': 5 };
        const reqLevel = this._normalizeLevelName(String(eduReq.level || "").toUpperCase());

        const userScore = hierarchy[userLevel] !== undefined ? hierarchy[userLevel] : -1;
        const reqScore = hierarchy[reqLevel] !== undefined ? hierarchy[reqLevel] : 0;

        // 4. STRICT ACADEMIC HIERARCHY CHECK
        if (reqScore > 0 && userScore < reqScore) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Education Mismatch: Bhai ${firstName}, isme ${reqLevel} manga hai, par aapne ${userLevel} kiya hai.`,
                score: 0,
                requirement: reqLevel,
                userHad: userLevel
            };
        }

        return {
            module: this.module,
            status: 'PASS',
            message: `Perfect Match: Bhai ${firstName}, aapki qualification (${userLevel}) is job ke liye sahi hai!`,
            score: 100,
            requirement: reqLevel,
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
