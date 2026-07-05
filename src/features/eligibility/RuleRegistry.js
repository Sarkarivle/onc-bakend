const AgeRule = require('./rules/AgeRule');
const EducationRule = require('./rules/EducationRule');

class RuleRegistry {
    constructor() {
        this.rules = [
            new AgeRule(),
            new EducationRule(),
        ];
    }
    getEnabledRules(constraints) {
        return this.rules;
    }
}
module.exports = new RuleRegistry();
