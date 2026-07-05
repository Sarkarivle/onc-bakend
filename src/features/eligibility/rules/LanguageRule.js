const BaseRule = require('./BaseRule');

class LanguageRule extends BaseRule {
    constructor() {
        super('LANGUAGE');
    }

    evaluate(user, constraints) {
        const requiredLang = constraints.language?.required;
        if (!requiredLang || requiredLang === 'ANY') {
            return { module: this.module, status: 'NA', message: "Not required" };
        }

        const userLangs = (user.languagesKnown || []).map(l => l.toUpperCase());
        const reqLang = String(requiredLang).toUpperCase();

        if (userLangs.length === 0) {
            return {
                module: this.module,
                status: 'INCOMPLETE',
                message: "Aapne kaun-kaun si bhashayein aati hain ye nahi bhara hai.",
                score: 0,
                field: 'languagesKnown'
            };
        }

        if (!userLangs.includes(reqLang)) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Is job ke liye ${reqLang} bhasha ki jankari zaroori hai.`,
                score: 0
            };
        }

        return {
            module: this.module,
            status: 'PASS',
            message: `Language Match: Aapko ${reqLang} aati hai.`,
            score: 100
        };
    }
}

module.exports = LanguageRule;
