const BaseRule = require('./BaseRule');

class DomicileRule extends BaseRule {
    constructor() {
        super('DOMICILE');
    }

    evaluate(user, constraints) {
        const requiredState = constraints.domicile?.state;
        if (!requiredState || requiredState === 'ANY') {
            return {
                module: this.module,
                status: 'PASS',
                message: "Ye job kisi bhi state ke candidate ke liye open hai.",
                score: 100
            };
        }

        const userState = (user.domicileState || "").toUpperCase();
        const reqState = String(requiredState).toUpperCase();

        if (!userState) {
            return {
                module: this.module,
                status: 'INCOMPLETE',
                message: "Aapka Domicile State missing hai. Maharashtra/Punjab ki jobs ke liye ye zaroori ho sakta hai.",
                score: 0,
                field: 'domicileState'
            };
        }

        if (userState !== reqState) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Is job ke liye ${reqState} ka niwas praman patra (Domicile) chahiye, par aapka ${userState} hai.`,
                score: 0
            };
        }

        return {
            module: this.module,
            status: 'PASS',
            message: `Domicile Match: Aap ${userState} ke rehne wale hain.`,
            score: 100
        };
    }
}

module.exports = DomicileRule;
