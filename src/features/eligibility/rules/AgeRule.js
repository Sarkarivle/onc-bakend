const BaseRule = require('./BaseRule');
const AgeCalculator = require('../utils/AgeCalculator');

class AgeRule extends BaseRule {
    constructor() { super('AGE'); }

    evaluate(user, constraints) {
        if (!user.dob) {
            return { module: this.module, status: 'INCOMPLETE', message: "DOB missing.", score: 0 };
        }

        const cutoff = constraints.age?.cutoff_date || new Date();
        const ageResult = AgeCalculator.calculate(user.dob, cutoff);

        if (!ageResult.success) {
            return { module: this.module, status: 'ERROR', message: ageResult.error, score: 0 };
        }

        const userAge = ageResult.data.years;
        const minAllowed = constraints.age?.min || 18;
        const maxAllowed = constraints.age?.effective_max || constraints.age?.max || 40;

        const isEligible = userAge >= minAllowed && userAge <= maxAllowed;

        return {
            module: this.module,
            status: isEligible ? 'PASS' : 'FAIL',
            message: isEligible
                ? `Age ${userAge} is within allowed range (${minAllowed}-${maxAllowed}).`
                : `Age ${userAge} is outside allowed range (${minAllowed}-${maxAllowed}).`,
            score: isEligible ? 100 : 0,
            data: ageResult.data
        };
    }
}
module.exports = AgeRule;
