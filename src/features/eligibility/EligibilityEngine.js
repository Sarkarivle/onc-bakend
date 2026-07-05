/**
 * Universal Eligibility Engine (UEE)
 * Top-level Orchestrator.
 */
const RuleRegistry = require('./RuleRegistry');
const RelaxationEngine = require('./RelaxationEngine');
const AgeCalculator = require('./utils/AgeCalculator');

class EligibilityEngine {
    static async evaluate(user, notification) {
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
            if (!notification || !notification.base_constraints) {
                throw new Error("NOTIFICATION_DATA_INCOMPLETE");
            }

            const baseConstraints = notification.base_constraints;
            const cutoffDate = baseConstraints.age?.cutoff_date || notification.createdAt || new Date();

            const ageResult = AgeCalculator.calculate(user.dob, cutoffDate);
            const ageRelaxation = RelaxationEngine.resolve(user, notification.relaxations, 'MAX_AGE');

            const baseMaxAge = Number(baseConstraints.age?.max) || 40;
            const effectiveMaxAge = baseMaxAge + ageRelaxation;

            report.age_analysis = {
                exact_age: ageResult.success ? ageResult.data : null,
                base_max_age: baseMaxAge,
                relaxation_applied: ageRelaxation,
                effective_max_age: effectiveMaxAge,
                cutoff_date: cutoffDate
            };

            const effectiveConstraints = {
                ...baseConstraints,
                age: { ...baseConstraints.age, effective_max: effectiveMaxAge, cutoff_date: cutoffDate }
            };

            const activeRules = RuleRegistry.getEnabledRules(effectiveConstraints);
            const evaluations = activeRules.map(rule => rule.evaluate(user, effectiveConstraints));

            evaluations.forEach(res => {
                if (res.status === 'PASS') {
                    report.applied_rules.push(res);
                } else if (res.status === 'FAIL') {
                    report.status = 'INELIGIBLE';
                    report.failed_rules.push(res);
                } else if (res.status === 'INCOMPLETE') {
                    if (report.status !== 'INELIGIBLE') report.status = 'INCOMPLETE_PROFILE';
                    report.missing_data.push(res);
                }
                report.summary.push(`${res.module}: ${res.message}`);
            });

            const totalModules = activeRules.length;
            const passedModules = report.applied_rules.length;
            report.match_score = totalModules > 0 ? Math.round((passedModules / totalModules) * 100) : 100;
            report.ai_tip = this._generateAiTip(report);

            return report;
        } catch (error) {
            console.error("UEE Error:", error);
            return { status: 'ERROR', message: error.message };
        }
    }

    static _generateAiTip(report) {
        if (report.status === 'ELIGIBLE') return "Bhai, aap is job ke liye bilkul fit ho! Mauka achha hai, apply kar do.";
        if (report.status === 'INELIGIBLE') return "Bhai, aapki requirements match nahi ho rahi hain. Details check karein.";
        if (report.status === 'INCOMPLETE_PROFILE') return "Aapki profile incomplete hai. Details bharo taaki main confirm kar sakoon.";
        return "Jankari check karein.";
    }
}

module.exports = EligibilityEngine;
