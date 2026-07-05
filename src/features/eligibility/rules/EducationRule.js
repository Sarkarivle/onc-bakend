const BaseRule = require('./BaseRule');

class EducationRule extends BaseRule {
    constructor() { super('EDUCATION'); }

    evaluate(user, constraints) {
        const requiredLevel = constraints.education?.level;
        if (!requiredLevel || requiredLevel === 'N/A') {
            return { module: this.module, status: 'PASS', message: "No education requirement.", score: 100 };
        }

        if (!user.education) {
            return { module: this.module, status: 'INCOMPLETE', message: "Education missing.", score: 0 };
        }

        const userLevel = String(user.education).toUpperCase();
        const reqLevel = String(requiredLevel).toUpperCase();

        const levels = {
            '8TH PASS': 1, '10TH PASS': 2, '12TH PASS': 3, 'ITI/DIPLOMA': 4,
            'GRADUATE': 5, 'POST GRADUATE': 6, 'PHD': 7
        };

        const isEligible = (levels[userLevel] || 0) >= (levels[reqLevel] || 0);

        return {
            module: this.module,
            status: isEligible ? 'PASS' : 'FAIL',
            message: isEligible
                ? `Education match: ${userLevel} fulfills ${reqLevel}.`
                : `Requirement failed: ${reqLevel} required, you have ${userLevel}.`,
            score: isEligible ? 100 : 0
        };
    }
}
module.exports = EducationRule;
