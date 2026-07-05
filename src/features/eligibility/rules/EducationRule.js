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

        const userLevel = (user.education || user.educationLevel || user.qualification || "").toUpperCase();

        // 2. CHECK IF DATA IS MISSING
        if (!userLevel) {
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

        const userScore = hierarchy[userLevel] || 0;
        const reqScore = hierarchy[reqLevel] || 0;

        // 3. STRICT ACADEMIC HIERARCHY CHECK
        if (reqScore > 0 && userScore < reqScore) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Galti: Bhai ${firstName}, is job ke liye kam se kam ${reqLevel} chahiye, lekin aapka profile ${userLevel} hai. Aap eligible nahi hain.`,
                score: 0
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
            score: 100
        };
    }

    _normalizeLevelName(text) {
        if (text.includes('PHD')) return 'PHD';
        if (text.includes('POST GRADUATE') || text.includes('PG')) return 'POST GRADUATE';
        if (text.includes('GRADUATE') || text.includes('DEGREE') || text.includes('BACHELOR')) return 'GRADUATE';
        if (text.includes('12TH') || text.includes('INTERMEDIATE') || text.includes('10+2')) return '12TH PASS';
        if (text.includes('10TH') || text.includes('MATRIC')) return '10TH PASS';
        return text;
    }
}

module.exports = EducationRule;
