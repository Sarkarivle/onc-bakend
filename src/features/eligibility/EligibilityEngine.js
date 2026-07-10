/**
 * Universal Eligibility Engine (UEE)
 * Top-level Orchestrator.
 */
const RuleRegistry = require('./RuleRegistry');
const RelaxationEngine = require('./RelaxationEngine');
const AgeCalculator = require('./utils/AgeCalculator');
const HumanExpertEngine = require('./HumanExpertEngine');

class EligibilityEngine {
    static async evaluate(user, notification, options = {}) {
        const firstName = user.name?.split(' ')[0] || "Dost";
        const report = {
            status: 'ELIGIBLE',
            match_score: 100,
            age_analysis: {},
            applied_rules: [],
            failed_rules: [],
            missing_data: [],
            summary: [],
            extra_notes: [],
            timestamp: new Date().toISOString()
        };

        try {
            if (!notification) throw new Error("NOTIFICATION_MISSING");

            // --- DATA NORMALIZATION ---
            const legacy = notification.eligibility || {};
            const fullData = notification.fullData || notification.full_data || {};

            // --- STRICT GENDER CHECK (Bada Bhai Gatekeeper) ---
            const userGender = (user.gender || '').toLowerCase();
            const jobTitle = (notification.title || '').toLowerCase();
            const jobEdu = (legacy.education || '').toLowerCase();

            let requiredGender = null;
            if (/female only|only for women|mahila special|women only|anganwadi/i.test(jobTitle + jobEdu)) {
                requiredGender = 'female';
            } else if (/male only|only for men|men only/i.test(jobTitle + jobEdu)) {
                requiredGender = 'male';
            }

            if (requiredGender === 'female' && (userGender === 'male' || userGender === 'm')) {
                return {
                    status: 'INELIGIBLE',
                    match_score: 0,
                    summary: ["Gender Mismatch: This job is for Female candidates only."],
                    failed_rules: [{ module: 'GENDER', status: 'FAIL', message: 'This job is for Female candidates only.' }],
                    dost_advice: ["Bhai, ye job sirf mahilaon (Females) ke liye hai. Aap dusri vacancies check karein."],
                    ai_tip: "Bhai, ye job sirf mahilaon (Females) ke liye hai. Aap dusri vacancies check karein.",
                    timestamp: new Date().toISOString()
                };
            }

            if (requiredGender === 'male' && (userGender === 'female' || userGender === 'f')) {
                return {
                    status: 'INELIGIBLE',
                    match_score: 0,
                    summary: ["Gender Mismatch: This job is for Male candidates only."],
                    failed_rules: [{ module: 'GENDER', status: 'FAIL', message: 'This job is for Male candidates only.' }],
                    dost_advice: ["Behen, ye job sirf purushon (Males) ke liye hai. Aap dusri vacancies check karein."],
                    ai_tip: "Behen, ye job sirf purushon (Males) ke liye hai. Aap dusri vacancies check karein.",
                    timestamp: new Date().toISOString()
                };
            }

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
                    if (res.isExtraMissing) {
                        report.extra_notes.push(`Jaruri Degree Missing: ${res.missingDegrees.join(', ')}`);
                    }
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
                if (res.status !== 'NA') report.summary.push(`${res.module}: ${res.message}`);
            });

            const totalModules = activeRules.length;
            const passedModules = report.applied_rules.length;
            let score = totalModules > 0 ? Math.round((passedModules / totalModules) * 100) : 100;

            // --- INTUITIVE SCORE PENALTY ---
            const mandatoryFails = report.failed_rules.filter(r => ['AGE', 'EDUCATION', 'GENDER'].includes(r.module));
            if (mandatoryFails.length > 0) {
                // If core criteria fails, score shouldn't be higher than 30% even if other things match
                score = Math.min(score, 30);
                if (mandatoryFails.length >= 2) score = 10;
            }
            report.match_score = score;

            // Add manual extra notes if provided in notification
            if (baseConstraints.extra_requirements) {
                report.extra_notes = [...report.extra_notes, ...baseConstraints.extra_requirements];
            }

            report.confidence_score = this._calculateConfidence(notification, report);

            // --- PERSONALIZED DOST ADVICE (v8.0) ---
            if (options.skipLLM) {
                report.dost_advice = HumanExpertEngine.generateInstantAdvice(user, report, notification.title);
                report.ai_tip = report.dost_advice[0];
                return report;
            }

            try {
                const adviceObj = await HumanExpertEngine.generateDostAdvice(user, report, notification.title, notification);
                report.dost_advice_obj = adviceObj;
                report.dost_advice = [adviceObj.details];
                report.ai_tip = adviceObj.banner;
            } catch (adviceErr) {
                console.error("Dost Advice Generation Failed:", adviceErr.message);
                report.dost_advice = ["Bhai, abhi jankari check ho rahi hai. Niche details dekho."];
                report.ai_tip = "Report check kar lo bhai.";
            }

            return report;
        } catch (error) {
            console.error("UEE Error:", error);
            return { status: 'ERROR', message: error.message };
        }
    }

    static _calculateConfidence(notif, report) {
        let score = 100;
        if (report.applied_rules.some(r => r.fromHtml)) score -= 20;
        if (!notif.base_constraints) score -= 15;
        if (report.status === 'INCOMPLETE_PROFILE') score -= 10;
        return score;
    }
}

module.exports = EligibilityEngine;
