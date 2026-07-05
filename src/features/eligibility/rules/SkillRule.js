const BaseRule = require('./BaseRule');

class SkillRule extends BaseRule {
    constructor() {
        super('SKILLS_AND_CERTS');
    }

    evaluate(user, constraints) {
        const reqSkills = constraints.skills || [];
        if (!reqSkills || reqSkills.length === 0) {
            return { module: this.module, status: 'NA', message: "Not required" };
        }

        const missing = [];
        const userCerts = (user.certificates || []).map(c => c.toUpperCase());
        const userTyping = (user.typingSkills || []).map(t => t.toUpperCase());

        reqSkills.forEach(skill => {
            const s = skill.toUpperCase();

            // Check Computer Certificates (CCC, O-Level)
            if (['CCC', 'O-LEVEL', 'PGDCA'].includes(s)) {
                if (!userCerts.includes(s)) missing.push(skill);
            }

            // Check Typing Skills
            if (s.includes('TYPING')) {
                const lang = s.includes('HINDI') ? 'HINDI' : 'ENGLISH';
                if (!userTyping.includes(lang)) missing.push(skill);
            }
        });

        if (missing.length > 0) {
            return {
                module: this.module,
                status: 'FAIL',
                message: `Ye certificates/skills missing hain: ${missing.join(', ')}`,
                score: 0
            };
        }

        return {
            module: this.module,
            status: 'PASS',
            message: "Sari required skills aur certificates aapke paas hain.",
            score: 100
        };
    }
}

module.exports = SkillRule;
