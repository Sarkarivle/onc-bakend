const BaseRule = require('./BaseRule');
const HtmlScanner = require('../utils/HtmlScanner');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints, jobContext = {}) {
        const eduReq = constraints.education;
        if (!eduReq || (!eduReq.level && !eduReq.required_degrees)) {
            // Check HTML Fallback if JSON is empty
            if (jobContext.fullHtmlContent) {
                const extracted = HtmlScanner.scan(jobContext.fullHtmlContent, 'EDUCATION');
                if (extracted) {
                   return this._runEvaluation(user, { level: extracted });
                }
            }
            return { module: this.module, status: 'PASS', message: "Education details isme mentioned nahi hain.", score: 100 };
        }

        return this._runEvaluation(user, eduReq);
    }

    _runEvaluation(user, eduReq) {
        const report = { module: this.module, status: 'PASS', message: "Education criteria match ho raha hai.", score: 100 };

        // 1. Academic Level Check (with Equivalency)
        if (eduReq.level && eduReq.level !== 'N/A') {
            const result = this._checkAcademicLevel(user, eduReq.level);
            if (result.status !== 'PASS') return result;
            report.message = result.message;
        }

        // 2. Stream Check
        if (eduReq.stream && eduReq.stream !== 'ANY') {
            const streamResult = this._checkStream(user, eduReq.stream);
            if (streamResult.status !== 'PASS') return streamResult;
        }

        // 3. Professional Degree Check (The "AND" condition)
        if (eduReq.required_degrees && eduReq.required_degrees.length > 0) {
            const profResult = this._checkProfessionalDegrees(user, eduReq.required_degrees);
            if (profResult.status !== 'PASS') return profResult;
        }

        return report;
    }

    _checkAcademicLevel(user, reqLevel) {
        const userLevel = (user.educationLevel || user.education || "").toUpperCase();
        const req = String(reqLevel).toUpperCase();

        const hierarchy = {
            '10TH PASS': 1,
            '12TH PASS': 2,
            'ITI/DIPLOMA': 2, // 3-yr Diploma is equivalent to 12th
            'GRADUATE': 3,
            'POST GRADUATE': 4,
            'PHD': 5
        };

        const userScore = hierarchy[userLevel] || 0;
        const reqScore = hierarchy[this._normalizeLevelName(req)] || 0;

        if (userScore < reqScore) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Is job ke liye ${req} chahiye, lekin aapka profile ${userLevel || 'None'} hai.`,
                score: 0
            };
        }
        return { status: 'PASS', message: `Base education matched (${userLevel}).` };
    }

    _checkStream(user, reqStream) {
        const userStream = (user.educationHistory?.twelfth?.stream || "").toUpperCase();
        if (!userStream) return { module: this.module, status: 'INCOMPLETE', message: "Aapki 12th stream (e.g. PCM) profile me missing hai.", score: 0 };

        if (!userStream.includes(reqStream.toUpperCase())) {
            return { module: this.module, status: 'FAIL', message: `Required Stream: ${reqStream}, Aapka: ${userStream}`, score: 0 };
        }
        return { status: 'PASS' };
    }

    _checkProfessionalDegrees(user, required) {
        const userDegrees = (user.professionalDegrees || []).map(d => d.toUpperCase());
        const missing = required.filter(req => !userDegrees.some(ud => ud.includes(req.toUpperCase())));

        if (missing.length > 0) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Professional degree missing: ${missing.join(', ')}`,
                score: 50
            };
        }
        return { status: 'PASS' };
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
