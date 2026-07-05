const BaseRule = require('./BaseRule');
const UnitConverter = require('../utils/UnitConverter');
const HtmlScanner = require('../utils/HtmlScanner');

class PhysicalRule extends BaseRule {
    constructor() { super('PHYSICAL'); }

    evaluate(user, constraints, jobContext = {}) {
        const firstName = user.name?.split(' ')[0] || "Dost";
        let physical = constraints.physical;
        const userGender = (user.gender || 'MALE').toLowerCase();
        const userCategory = (user.category || 'GENERAL').toUpperCase();

        // 1. HTML FALLBACK (Deep Scan for tables)
        if ((!physical || Object.keys(physical).length === 0) && jobContext.fullHtmlContent) {
            const extractedHeight = HtmlScanner.scan(jobContext.fullHtmlContent, 'HEIGHT', { gender: user.gender });
            if (extractedHeight) {
                physical = { [userGender]: { [userCategory]: { height: extractedHeight } } };
            }
        }

        if (!physical || typeof physical !== 'object') {
            return { module: this.module, status: 'NA', message: "Not required" };
        }

        // 2. GET PRECISE RULE (Gender + Category)
        const genderRules = physical[userGender] || physical.male || physical.female;
        if (!genderRules) return { module: this.module, status: 'NA', message: "No rule for your gender." };

        const rule = genderRules[userCategory] || genderRules['ANY'] || genderRules['GENERAL'] || (userCategory !== 'GENERAL' ? genderRules['OTHER'] : null);

        if (!rule) {
            return { module: this.module, status: 'INCOMPLETE', message: `Bhai ${firstName}, aapki category (${userCategory}) ke physical rules nahi mile. Manual check karein.` };
        }

        const reqHeight = rule.height || rule.male_height || rule.female_height;
        const userHeightCM = UnitConverter.heightToCM(user.height);

        // 3. STRICT VALIDATION
        if (reqHeight) {
            if (!user.height) return { module: this.module, status: 'INCOMPLETE', message: `Bhai ${firstName}, apni Height dalo profile me. Is job ke liye ${reqHeight}cm zaroori hai.`, field: 'height' };

            if (userHeightCM < reqHeight) {
                return {
                    module: this.module,
                    status: 'FAIL',
                    message: `Height Mismatch: Bhai ${firstName}, isme ${reqHeight}cm height chahiye, par aapki ${userHeightCM}cm hai. Aap eligible nahi ho sakte.`,
                    score: 0
                };
            }
        }

        return { module: this.module, status: 'PASS', message: `Physical Match: Bhai ${firstName}, aapki physical details rules ke hisab se ekdum fit hain!`, score: 100 };
    }
}

module.exports = PhysicalRule;
