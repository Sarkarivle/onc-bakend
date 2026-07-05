const AgeRule = require('./rules/AgeRule');
const EducationRule = require('./rules/EducationRule');
const PhysicalRule = require('./rules/PhysicalRule');
const SkillRule = require('./rules/SkillRule');
const DomicileRule = require('./rules/DomicileRule');
const LanguageRule = require('./rules/LanguageRule');

class RuleRegistry {
    constructor() {
        this.rules = [
            new AgeRule(),
            new EducationRule(),
            new PhysicalRule(),
            new SkillRule(),
            new DomicileRule(),
            new LanguageRule(),
        ];
    }
    getEnabledRules(constraints) {
        return this.rules;
    }
}
module.exports = new RuleRegistry();
