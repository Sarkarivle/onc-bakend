const BaseRule = require('./BaseRule');
const UnitConverter = require('../utils/UnitConverter');

class PhysicalRule extends BaseRule {
    constructor() {
        super('PHYSICAL');
    }

    evaluate(user, constraints) {
        const physical = constraints.physical;
        // Support both flat legacy format and new multidimensional format
        if (!physical || (typeof physical !== 'object')) {
            return { module: this.module, status: 'PASS', message: "Physical requirements isme mentioned nahi hain.", score: 100 };
        }

        const userGender = (user.gender || 'MALE').toLowerCase();
        const userCategory = (user.category || 'GENERAL').toUpperCase();

        // 1. Get Gender Specific Rules
        const genderRules = physical[userGender] || (userGender === 'male' ? physical.male : physical.female);
        if (!genderRules) return { module: this.module, status: 'PASS', message: "Aapke gender ke liye koi physical rule nahi mila.", score: 100 };

        // 2. Get Category Specific Rules (or fallback to GENERAL/ANY)
        const rule = genderRules[userCategory] || genderRules['ANY'] || genderRules['GENERAL'] || genderRules;

        const reqHeight = rule.height || rule.male_height || rule.female_height;
        const reqChest = rule.chest || rule.male_chest;

        if (!reqHeight && !reqChest) return { module: this.module, status: 'PASS', message: "No specific height/chest required.", score: 100 };

        // 3. User Stats Normalization
        const userHeightCM = UnitConverter.heightToCM(user.height);

        // 4. Validation
        if (reqHeight) {
            if (!user.height || user.height == 0) {
                return { module: this.module, status: 'INCOMPLETE', message: "Height missing in profile. Police jobs ke liye ye zaroori hai.", score: 0 };
            }
            if (userHeightCM < reqHeight) {
                return { module: this.module, status: 'FAIL', message: `Height kam hai. Required: ${reqHeight}cm, Aapki: ${userHeightCM}cm.`, score: 0 };
            }
        }

        if (userGender === 'male' && reqChest) {
            if (!user.chest) {
                return { module: this.module, status: 'INCOMPLETE', message: "Seena (Chest) measurement missing hai.", score: 0 };
            }
            if (user.chest < reqChest) {
                return { module: this.module, status: 'FAIL', message: `Chest mismatch. Required: ${reqChest}cm, Aapka: ${user.chest}cm.`, score: 0 };
            }
        }

        return { module: this.module, status: 'PASS', message: "Physical Standards Match: Aap bilkul fit hain!", score: 100 };
    }
}

module.exports = PhysicalRule;
