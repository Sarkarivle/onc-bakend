const BaseRule = require('./BaseRule');
const HtmlScanner = require('../utils/HtmlScanner');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints, jobContext = {}) {
        const firstName = user.name?.split(' ')[0] || "Dost";
        const eduReq = constraints.education;

        if (!eduReq || (!eduReq.level && !eduReq.required_degrees)) {
            if (jobContext.fullHtmlContent) {
                const extracted = HtmlScanner.scan(jobContext.fullHtmlContent, 'EDUCATION');
                if (extracted) return this._runEvaluation(user, { level: extracted }, firstName);
            }
            return { module: this.module, status: 'PASS', message: `Bhai ${firstName}, is job me koi khaas education level mentioned nahi hai.`, score: 100 };
        }

        return this._runEvaluation(user, eduReq, firstName);
    }

    _runEvaluation(user, eduReq, firstName) {
        const userLevel = (user.education || user.qualification || "").toUpperCase();

        // 1. Check if user has even filled the basic level
        if (!userLevel) {
            return {
                module: this.module,
                status: 'INCOMPLETE',
                message: `Bhai ${firstName}, aapne apni padhai ki detail (10th/12th/Grad) nahi bhari hai.`,
                score: 0,
                field: 'education'
            };
        }

        // 2. BASIC ACADEMIC MATCH (The Foundation)
        if (eduReq.level && eduReq.level !== 'N/A') {
            const hierarchy = { '10TH PASS': 1, '12TH PASS': 2, 'ITI/DIPLOMA': 2, 'GRADUATE': 3, 'POST GRADUATE': 4, 'PHD': 5 };
            const normalizedReq = this._normalizeLevelName(eduReq.level.toUpperCase());

            const userScore = hierarchy[userLevel] || 0;
            const reqScore = hierarchy[normalizedReq] || 0;

            if (userScore < reqScore) {
                return {
                    module: this.module,
                    status: 'FAIL',
                    message: `Bhai ${firstName}, is job ke liye kam se kam ${normalizedReq} chahiye, lekin aapka profile ${userLevel} hai.`,
                    score: 0,
                    isBasicMismatch: true
                };
            }
        }

        // 3. PROFESSIONAL DEGREES (The Add-ons)
        const requiredDegrees = eduReq.required_degrees || [];
        const userProfDegrees = (user.professionalDegrees || []).map(d => d.toUpperCase());

        if (requiredDegrees.length > 0) {
            const missing = requiredDegrees.filter(req => !userProfDegrees.some(ud => ud.includes(req.toUpperCase())));
            if (missing.length > 0) {
                return {
                    module: this.module,
                    status: 'PASS', // Basic level matched, so we don't Hard Fail
                    message: `Bhai ${firstName}, aapki base qualification sahi hai, par isme ye Professional degrees bhi chahiye: ${missing.join(', ')}`,
                    score: 80,
                    isExtraMissing: true,
                    missingDegrees: missing
                };
            }
        }

        return {
            module: this.module,
            status: 'PASS',
            message: `Bhai ${firstName}, aapki qualification (${userLevel}) is job ke liye bilkul sahi hai!`,
            score: 100
        };
    }

    _normalizeLevelName(text) {
        if (text.includes('10TH') || text.includes('MATRIC')) return '10TH PASS';
        if (text.includes('12TH') || text.includes('INTERMEDIATE') || text.includes('10+2')) return '12TH PASS';
        if (text.includes('ITI') || text.includes('DIPLOMA')) return 'ITI/DIPLOMA';
        if (text.includes('GRADUATE') || text.includes('DEGREE')) return 'GRADUATE';
        if (text.includes('POST GRADUATE')) return 'POST GRADUATE';
        return text;
    }
}

module.exports = EducationRule;
