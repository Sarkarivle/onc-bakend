const AgeRule = require('./rules/AgeRule');
const EducationRule = require('./rules/EducationRule');
const PhysicalRule = require('./rules/PhysicalRule');
const SkillRule = require('./rules/SkillRule');

class RuleRegistry {
    constructor() {
        this.rules = [
            new AgeRule(),
            new EducationRule(),
            new PhysicalRule(),
            new SkillRule(),
        ];
    }
    getEnabledRules(constraints) {
        return this.rules;
    }
}
module.exports = new RuleRegistry();
