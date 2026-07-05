const BaseRule = require('./BaseRule');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints) {
        const requiredLevel = constraints.education?.level;
        if (!requiredLevel || requiredLevel === 'N/A') {
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
        const reqLevel = String(requiredLevel).toUpperCase();

        const levels = {
            '8TH PASS': 1, '10TH PASS': 2, '12TH PASS': 3, 'ITI/DIPLOMA': 4,
            'GRADUATE': 5, 'POST GRADUATE': 6, 'PHD': 7
        };

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
