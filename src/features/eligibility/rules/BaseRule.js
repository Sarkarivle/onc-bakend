class BaseRule {
    constructor(moduleName) {
        if (this.constructor === BaseRule) throw new Error("Cannot instantiate abstract class.");
        this.module = moduleName;
    }
    evaluate(user, constraints) {
        throw new Error("Evaluate must be implemented.");
    }
}
module.exports = BaseRule;
