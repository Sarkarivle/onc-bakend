const BaseRule = require('./BaseRule');
const UnitConverter = require('../utils/UnitConverter');
const HtmlScanner = require('../utils/HtmlScanner');

class PhysicalRule extends BaseRule {
    constructor() {
        super('PHYSICAL');
    }

    evaluate(user, constraints, jobContext = {}) {
        let physical = constraints.physical;
        const userGender = (user.gender || 'MALE').toLowerCase();
        const userCategory = (user.category || 'GENERAL').toUpperCase();

        // --- HTML FALLBACK LOGIC ---
        if ((!physical || (typeof physical === 'object' && Object.keys(physical).length === 0)) && jobContext.fullHtmlContent) {
            const extractedHeight = HtmlScanner.scan(jobContext.fullHtmlContent, 'HEIGHT', { gender: user.gender });
            if (extractedHeight) {
                physical = {};
                const target = userGender === 'female' ? 'female' : 'male';
                physical[target] = { ANY: { height: extractedHeight } };
                physical.fromHtml = true;
            }
        }

        if (!physical || (typeof physical !== 'object')) {
            return { module: this.module, status: 'PASS', message: "Physical requirements isme mentioned nahi hain.", score: 100 };
        }

        // 1. Get Gender Specific Rules
        const genderRules = physical[userGender] || (userGender === 'male' ? physical.male : physical.female);
        if (!genderRules) return { module: this.module, status: 'PASS', message: "Aapke gender ke liye koi physical rule nahi mila.", score: 100 };

        // 2. Get Category Specific Rules
        // CRITICAL FIX: Don't fallback to SC/ST if user is GENERAL
        const rule = genderRules[userCategory] || genderRules['ANY'] || (userCategory === 'GENERAL' ? null : (genderRules['OTHER'] || genderRules['GENERAL']));

        if (!rule) {
            return {
                module: this.module,
                status: 'INCOMPLETE',
                message: `Aapki category (${userCategory}) ke liye physical rules nahi mile. Manual check karein.`,
                score: 0
            };
        }

        const reqHeight = rule.height || rule.male_height || rule.female_height;
        const reqChestNormal = rule.chest || rule.male_chest || rule.chest_normal;
        const reqChestExp = rule.chest_expanded || (reqChestNormal ? reqChestNormal + 5 : null);

        if (!reqHeight && !reqChestNormal) return { module: this.module, status: 'PASS', message: "No specific height/chest required.", score: 100 };

        // 3. User Stats Normalization
        const userHeightCM = UnitConverter.heightToCM(user.height);

        // 4. Validation
        if (reqHeight) {
            if (!user.height || user.height == 0) {
                return { module: this.module, status: 'INCOMPLETE', message: "Height missing in profile. Police jobs ke liye ye zaroori hai.", score: 0, field: 'height' };
            }
            if (userHeightCM < reqHeight) {
                return { module: this.module, status: 'FAIL', message: `Height kam hai. Required: ${reqHeight}cm, Aapki: ${userHeightCM}cm.`, score: 0 };
            }
        }

        if (userGender === 'male' && reqChestNormal) {
            if (!user.chest) {
                return { module: this.module, status: 'INCOMPLETE', message: "Seena (Chest) measurement missing hai.", score: 0, field: 'chest' };
            }
            // Logic: 1. Must meet base chest. 2. Must meet expansion (usually 5cm)
            if (user.chest < reqChestNormal) {
                return { module: this.module, status: 'FAIL', message: `Chest mismatch. Kam se kam ${reqChestNormal}cm chahiye.`, score: 0 };
            }
            // If user has expanded chest data, check it
            if (user.chestExpanded && user.chestExpanded < reqChestExp) {
                return { module: this.module, status: 'FAIL', message: `Chest expansion kam hai. 5cm phulav zaroori hai.`, score: 0 };
            }
        }

        return { module: this.module, status: 'PASS', message: "Physical Standards Match: Aap bilkul fit hain!", score: 100 };
    }
}

module.exports = PhysicalRule;
