const BaseRule = require('./BaseRule');

class PhysicalRule extends BaseRule {
    constructor() {
        super('PHYSICAL');
    }

    evaluate(user, constraints) {
        const physical = constraints.physical;
        if (!physical || (!physical.height && !physical.chest)) {
            return {
                module: this.module,
                status: 'PASS',
                message: "Is job me physical requirements mentioned nahi hain.",
                score: 100
            };
        }

        const report = {
            module: this.module,
            status: 'PASS',
            message: "Physical requirements match ho rahi hain.",
            score: 100
        };

        const userGender = (user.gender || 'MALE').toUpperCase();

        // --- HEIGHT CHECK ---
        const reqHeight = userGender === 'FEMALE' ? physical.female_height : physical.male_height;
        if (reqHeight) {
            if (!user.height) {
                return {
                    module: this.module,
                    status: 'INCOMPLETE',
                    message: "Police/Army jobs ke liye Height zaroori hai. Profile update karein.",
                    score: 0
                };
            }
            if (user.height < reqHeight) {
                return {
                    module: this.module,
                    status: 'FAIL',
                    message: `Height mismatch: Kam se kam ${reqHeight}cm chahiye, aapki ${user.height}cm hai.`,
                    score: 0
                };
            }
        }

        // --- CHEST CHECK (Usually Male Only) ---
        if (userGender === 'MALE' && physical.male_chest) {
            if (!user.chest) {
                // Not hard failing yet, just adding a note
                report.status = 'INCOMPLETE';
                report.message = "Seena (Chest) ki details missing hain. Profile update karein.";
            } else if (user.chest < physical.male_chest) {
                return {
                    module: this.module,
                    status: 'FAIL',
                    message: `Chest mismatch: Required ${physical.male_chest}cm, aapka ${user.chest}cm hai.`,
                    score: 0
                };
            }
        }

        return report;
    }
}

module.exports = PhysicalRule;
