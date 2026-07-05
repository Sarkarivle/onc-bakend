/**
 * Universal Eligibility Engine (UEE)
 * Top-level Orchestrator.
 */
const RuleRegistry = require('./RuleRegistry');
const RelaxationEngine = require('./RelaxationEngine');
const AgeCalculator = require('./utils/AgeCalculator');

class EligibilityEngine {
    static async evaluate(user, notification) {
        const firstName = user.name?.split(' ')[0] || "Dost";
        const report = {
            status: 'ELIGIBLE',
            match_score: 100,
            age_analysis: {},
            applied_rules: [],
            failed_rules: [],
            missing_data: [],
            summary: [],
            timestamp: new Date().toISOString()
        };

        try {
            if (!notification) throw new Error("NOTIFICATION_MISSING");

            // --- DATA NORMALIZATION FOR ENGINE ---
            const legacy = notification.eligibility || {};
            const fullData = notification.fullData || notification.full_data || {};

            const baseConstraints = notification.base_constraints || {
                age: {
                    min: parseInt(legacy.minAge) || 18,
                    max: parseInt(legacy.maxAge) || 40,
                    cutoff_date: notification.lastDate || legacy.ageLimit || new Date()
                },
                education: {
                    level: legacy.education || 'N/A'
                },
                physical: fullData.physical_standards || fullData.physical || null,
                skills: fullData.skills || fullData.required_skills || []
            };
            const cutoffDate = baseConstraints.age?.cutoff_date || notification.createdAt || new Date();

            const ageResult = AgeCalculator.calculate(user.dob, cutoffDate);
            const ageRelaxation = RelaxationEngine.resolve(user, notification.relaxations, 'MAX_AGE');

            const baseMinAge = Number(baseConstraints.age?.min) || 18;
            const baseMaxAge = Number(baseConstraints.age?.max) || 40;
            const effectiveMaxAge = baseMaxAge + ageRelaxation;

            // Indian Format for Cutoff Date
            const cutoffDateObj = new Date(cutoffDate);
            const indianCutoffDate = `${String(cutoffDateObj.getDate()).padStart(2, '0')}-${String(cutoffDateObj.getMonth() + 1).padStart(2, '0')}-${cutoffDateObj.getFullYear()}`;

            report.age_analysis = {
                exact_age: ageResult.success ? ageResult.data : null,
                base_min_age: baseMinAge,
                base_max_age: baseMaxAge,
                relaxation_applied: ageRelaxation,
                effective_max_age: effectiveMaxAge,
                cutoff_date: indianCutoffDate
            };

            const effectiveConstraints = {
                ...baseConstraints,
                age: { ...baseConstraints.age, effective_max: effectiveMaxAge, cutoff_date: cutoffDate }
            };

            const activeRules = RuleRegistry.getEnabledRules(effectiveConstraints);
            const evaluations = activeRules.map(rule => rule.evaluate(user, effectiveConstraints, notification));

            evaluations.forEach(res => {
                if (res.status === 'PASS') {
                    report.applied_rules.push(res);
                } else if (res.status === 'FAIL') {
                    report.status = 'INELIGIBLE';
                    report.failed_rules.push(res);
                } else if (res.status === 'INCOMPLETE') {
                    if (report.status !== 'INELIGIBLE') report.status = 'INCOMPLETE_PROFILE';
                    report.missing_data.push(res);
                    if (res.field) {
                       report.missing_fields = report.missing_fields || [];
                       report.missing_fields.push(res.field);
                    }
                }
                report.summary.push(`${res.module}: ${res.message}`);
            });

            const totalModules = activeRules.length;
            const passedModules = report.applied_rules.length;
            report.match_score = totalModules > 0 ? Math.round((passedModules / totalModules) * 100) : 100;

            // --- CONFIDENCE SCORING ---
            report.confidence_score = this._calculateConfidence(notification, report);

            // --- PERSONALIZED AI TIP ---
            if (report.status === 'ELIGIBLE') {
                report.ai_tip = `Bhai ${firstName}, aap is job ke liye ekdum fit ho! Padhai aur physical dono sahi hain. Apply kar do.`;
            } else if (report.status === 'INELIGIBLE') {
                const reasons = report.failed_rules.map(r => r.module).join(' aur ');
                report.ai_tip = `Bhai ${firstName}, aapka ${reasons} requirement match nahi ho raha hai, isliye aap eligible nahi ho.`;
            } else {
                report.ai_tip = `Bhai ${firstName}, aapki profile me kuch details missing hain. Inhe bharo taaki main confirm kar sakoon.`;
            }

            return report;
        } catch (error) {
            console.error("UEE Error:", error);
            return { status: 'ERROR', message: error.message };
        }
    }

    static _calculateConfidence(notif, report) {
        let score = 100;
        if (report.applied_rules.some(r => r.fromHtml) || report.failed_rules.some(r => r.fromHtml)) {
            score -= 20;
        }
        if (!notif.base_constraints) {
            score -= 15;
        }
        if (report.status === 'INCOMPLETE_PROFILE') {
            score -= 10;
        }
        return score;
    }
}

module.exports = EligibilityEngine;
