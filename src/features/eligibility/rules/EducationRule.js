const BaseRule = require('./BaseRule');
const HtmlScanner = require('../utils/HtmlScanner');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints, jobContext = {}) {
        const firstName = user.name?.split(' ')[0] || "Dost";
        let eduReq = constraints.education;

        // 1. HTML DEEP SCAN (If JSON is loose or empty)
        if (!eduReq || (!eduReq.level && !eduReq.required_degrees)) {
            if (jobContext.fullHtmlContent) {
                const extracted = HtmlScanner.scan(jobContext.fullHtmlContent, 'EDUCATION');
                if (extracted) eduReq = { level: extracted };
            }
        }

        if (!eduReq || (!eduReq.level && !eduReq.required_degrees)) {
            return { module: this.module, status: 'PASS', message: `Bhai ${firstName}, is job me koi khaas education level mentioned nahi hai.`, score: 100 };
        }

        const userLevelRaw = (user.education || user.educationLevel || user.qualification || "").toUpperCase();
        const userLevel = this._normalizeLevelName(userLevelRaw);

        // 2. CHECK IF DATA IS MISSING
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

        // 3. STRICT ACADEMIC HIERARCHY CHECK
        if (reqScore > 0 && userScore < reqScore) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Education Mismatch: Bhai ${firstName}, isme ${reqLevel} manga hai, par aapne ${userLevel} kiya hai. Qualification match nahi ho rahi.`,
                score: 0,
                requirement: reqLevel,
                userHad: userLevel
            };
        }

        // 4. PROFESSIONAL DEGREE CHECK (The "Yellow" Logic)
        const requiredDegrees = eduReq.required_degrees || [];
        const userProfDegrees = (user.professionalDegrees || []).map(d => d.toUpperCase());

        if (requiredDegrees.length > 0) {
            const missing = requiredDegrees.filter(req => !userProfDegrees.some(ud => ud.includes(req.toUpperCase())));
            if (missing.length > 0) {
                return {
                    module: this.module,
                    status: 'PASS', // Basic level passes, but extra missing
                    message: `Basic Match: Bhai ${firstName}, aapki qualification (${userLevel}) sahi hai, par isme ye bhi chahiye: ${missing.join(', ')}. Inke bina apply mat karna.`,
                    score: 70,
                    isExtraMissing: true,
                    missingDegrees: missing
                };
            }
        }

        return {
            module: this.module,
            status: 'PASS',
            message: `Perfect Match: Bhai ${firstName}, aapki qualification (${userLevel}) is job ke liye bilkul sahi hai!`,
            score: 100,
            requirement: reqLevel
        };
    }

    _normalizeLevelName(text) {
        const t = String(text || "").toUpperCase();
        if (t.includes('PHD')) return 'PHD';
        if (t.includes('POST GRADUATE') || t.includes('PG') || t.includes('MASTER')) return 'POST GRADUATE';
        if (t.includes('GRADUATE') || t.includes('DEGREE') || t.includes('BACHELOR') || t.includes('B.A') || t.includes('B.SC') || t.includes('B.COM') || t.includes('B.TECH')) return 'GRADUATE';
        if (t.includes('12TH') || t.includes('INTERMEDIATE') || t.includes('10+2') || t.includes('HSC')) return '12TH PASS';
        if (t.includes('10TH') || t.includes('MATRIC') || t.includes('SSC')) return '10TH PASS';
        if (t.includes('8TH')) return '8TH PASS';
        return t;
    }
}

module.exports = EducationRule;
