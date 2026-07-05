const BaseRule = require('./BaseRule');
const HtmlScanner = require('../utils/HtmlScanner');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints, jobContext = {}) {
        let rawRequired = constraints.education?.level;
        const requiredDegrees = constraints.education?.required_degrees || []; // Array: ["B.ED", "BTC"]

        // --- HTML FALLBACK ---
        if ((!rawRequired || rawRequired === 'N/A' || rawRequired === 'Check Notification') && jobContext.fullHtmlContent) {
            const extractedEdu = HtmlScanner.scan(jobContext.fullHtmlContent, 'EDUCATION');
            if (extractedEdu) rawRequired = extractedEdu;
        }

        if (!rawRequired || rawRequired === 'N/A' || rawRequired === 'Check Notification') {
            return {
                module: this.module,
                status: 'PASS',
                message: "Education details isme explicitly mentioned nahi hain. Ek baar notification check kar lein.",
                score: 100
            };
        }

        if (!user.education) {
            return {
                module: this.module,
                status: 'INCOMPLETE',
                message: "Aapki qualification profile me missing hai. Please profile update karein.",
                score: 0
            };
        }

        const userLevel = String(user.education).toUpperCase();
        const reqText = String(rawRequired).toUpperCase();
        const userProfDegrees = (user.professionalDegrees || []).map(d => d.toUpperCase());

        const levels = {
            '8TH PASS': 1, '10TH PASS': 2, '12TH PASS': 3, 'ITI/DIPLOMA': 4,
            'GRADUATE': 5, 'POST GRADUATE': 6, 'PHD': 7
        };

        // 1. Level Normalization
        let reqLevel = '8TH PASS';
        if (reqText.includes('PHD')) reqLevel = 'PHD';
        else if (reqText.includes('POST GRADUATE') || reqText.includes('PG ')) reqLevel = 'POST GRADUATE';
        else if (reqText.includes('GRADUATE') || reqText.includes('DEGREE') || reqText.includes('BACHELOR')) reqLevel = 'GRADUATE';
        else if (reqText.includes('ITI') || reqText.includes('DIPLOMA')) reqLevel = 'ITI/DIPLOMA';
        else if (reqText.includes('12TH') || reqText.includes('10+2') || reqText.includes('INTERMEDIATE') || reqText.includes('SECONDARY')) reqLevel = '12TH PASS';
        else if (reqText.includes('10TH') || reqText.includes('MATRIC')) reqLevel = '10TH PASS';

        const userScore = levels[userLevel] || 0;
        const reqScore = levels[reqLevel] || 0;

        // 2. Academic Level Check
        if (userScore < reqScore) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Requirement match nahi hui. Is job ke liye kam se kam ${reqLevel} chahiye, lekin aapka profile ${userLevel} hai.`,
                score: 0
            };
        }

        // 3. Professional Degree Check (The "AND" Logic)
        if (requiredDegrees.length > 0) {
            const missing = requiredDegrees.filter(d => !userProfDegrees.includes(d.toUpperCase()));
            if (missing.length > 0) {
                return {
                    module: this.module,
                    status: 'FAIL',
                    message: `Aapke paas Degree toh hai, par ye Professional Degrees missing hain: ${missing.join(', ')}`,
                    score: 50
                };
            }
        }

        return {
            module: this.module,
            status: 'PASS',
            message: "Education Match: Aapki academic aur professional qualification sahi hai.",
            score: 100
        };
    }
}

module.exports = EducationRule;
