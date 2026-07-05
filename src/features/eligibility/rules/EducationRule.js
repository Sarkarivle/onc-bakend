const BaseRule = require('./BaseRule');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints) {
        const rawRequired = constraints.education?.level;
        if (!rawRequired || rawRequired === 'N/A' || rawRequired === 'Check Notification') {
            return {
                module: this.module,
                status: 'PASS',
                message: "Is job me koi khaas education level mentioned nahi hai. Ek baar notification check kar lein.",
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

        const levels = {
            '8TH PASS': 1, '10TH PASS': 2, '12TH PASS': 3, 'ITI/DIPLOMA': 4,
            'GRADUATE': 5, 'POST GRADUATE': 6, 'PHD': 7
        };

        // Normalize messy requirement string to canonical level
        let reqLevel = '8TH PASS';
        if (reqText.includes('PHD')) reqLevel = 'PHD';
        else if (reqText.includes('POST GRADUATE') || reqText.includes('PG ')) reqLevel = 'POST GRADUATE';
        else if (reqText.includes('GRADUATE') || reqText.includes('DEGREE') || reqText.includes('BACHELOR')) reqLevel = 'GRADUATE';
        else if (reqText.includes('ITI') || reqText.includes('DIPLOMA')) reqLevel = 'ITI/DIPLOMA';
        else if (reqText.includes('12TH') || reqText.includes('10+2') || reqText.includes('INTERMEDIATE') || reqText.includes('SECONDARY')) reqLevel = '12TH PASS';
        else if (reqText.includes('10TH') || reqText.includes('MATRIC')) reqLevel = '10TH PASS';

        const userScore = levels[userLevel] || 0;
        const reqScore = levels[reqLevel] || 0;

        if (userScore < reqScore) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Requirement match nahi hui. Kam se kam ${reqLevel} chahiye, lekin aapka profile ${userLevel} hai.`,
                score: 0
            };
        }

        return {
            module: this.module,
            status: 'PASS',
            message: userScore > reqScore
                ? `Aapki qualification (${userLevel}) required level (${reqLevel}) se upar hai. Perfect!`
                : `Education Match: Aapki qualification ${userLevel} hai.`,
            score: 100
        };
    }
}
module.exports = EducationRule;
