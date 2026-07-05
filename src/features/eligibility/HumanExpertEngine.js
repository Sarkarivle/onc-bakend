const LLMProvider = require('../ai/generation/core_engine/llmProvider');
const expertPrompt = require('./prompts/expert_reasoning');
const UnitConverter = require('./utils/UnitConverter');

class HumanExpertEngine {
    /**
     * Converts raw eligibility data into a friendly "Dost" conversation.
     */
    static async generateDostAdvice(user, report, jobTitle, notification = {}) {
        try {
            const userName = user.name || "Dost";
            const firstName = userName.split(' ')[0];
            const ageStr = report.age_analysis?.exact_age?.formatted || "N/A";
            const userHeightCM = UnitConverter.heightToCM(user.height);

            const profileStr = `User: ${firstName}, Gender: ${user.gender || 'MALE'}, Qualification: ${user.educationLevel || user.education || 'N/A'}, Age: ${ageStr}, Category: ${user.category || 'GENERAL'}, State: ${user.domicileState || 'N/A'}, Height: ${userHeightCM > 0 ? userHeightCM + 'cm' : 'N/A'}`;

            const fullData = notification.fullData || notification.full_data || {};

            // Prune fullData to fit context window
            const prunedJobData = {
                title: jobTitle,
                eligibility: fullData.eligibility || fullData.structured_data?.eligibility,
                age_limit: fullData.age_limit || fullData.structured_data?.age_limit,
                physical_standard: fullData.physical_standard || fullData.structured_data?.physical_standard,
                vacancy_details: fullData.vacancy_details || fullData.structured_data?.vacancy_details,
                important_dates: fullData.important_dates || fullData.structured_data?.important_dates,
                who_can_apply: fullData.who_can_apply,
                extra_requirements: fullData.rule_map?.extra_requirements
            };

            const jobBrief = {
                title: jobTitle,
                description: (notification.description || "").substring(0, 300), // Truncate long descriptions
                fullData: prunedJobData
            };

            const educationFact = (report.applied_rules.find(r => r.module === 'EDUCATION') || report.failed_rules.find(r => r.module === 'EDUCATION'));
            const ageFact = (report.applied_rules.find(r => r.module === 'AGE') || report.failed_rules.find(r => r.module === 'AGE'));
            const physicalFact = (report.applied_rules.find(r => r.module === 'PHYSICAL') || report.failed_rules.find(r => r.module === 'PHYSICAL'));

            const facts = {
                overall_status: report.status,
                engine_decisions: {
                    education: educationFact ? { status: educationFact.status, user_qualification: educationFact.userHad, job_requirement: educationFact.requirement, friendly_msg: educationFact.message } : null,
                    age: ageFact ? { status: ageFact.status, user_age: report.age_analysis?.exact_age?.formatted, min_allowed: report.age_analysis.base_min_age, max_allowed: report.age_analysis.effective_max_age, friendly_msg: ageFact.message } : null,
                    physical: physicalFact ? { status: physicalFact.status, user_height: userHeightCM > 0 ? userHeightCM + 'cm' : 'N/A', required_height: physicalFact.requirement, friendly_msg: physicalFact.message } : null
                },
                extra_notes: report.extra_notes || [],
                missing_data: report.missing_data.map(r => r.message)
            };

            const istDate = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(new Date());

            const prompt = expertPrompt(userName, profileStr, facts, jobBrief, istDate);

            // Call the LLM to get the human-friendly reasoning (Using Chat for personality and text output)
            const chatRes = await LLMProvider.chat([{ role: 'user', content: prompt }]);
            const response = chatRes?.content;

            if (response && typeof response === 'string') {
                const points = response
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.replace(/^-\s*\[POINT\]\s*/i, '').replace(/^- /i, '').replace(/^✅\s*/, '✅ ').replace(/^❌\s*/, '❌ ').trim());

                if (points.length > 0) return points;
                return [response.replace(/^<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/i, '').trim().substring(0, 500)];
            }

            return ["Bhai, jankari process nahi ho paayi. Ek baar details check kar lo."];
        } catch (error) {
            console.error("HumanExpertEngine Error:", error.message);
            return ["Bhai, abhi brain thoda busy hai. Manual report check kar lo niche."];
        }
    }

    /**
     * Streams the advice chunk by chunk.
     */
    static async streamDostAdvice(user, report, jobTitle, notification = {}, onChunk) {
        try {
            const userName = user.name || "Dost";
            const firstName = userName.split(' ')[0];
            const ageStr = report.age_analysis?.exact_age?.formatted || "N/A";
            const userHeightCM = UnitConverter.heightToCM(user.height);

            const profileStr = `User: ${firstName}, Gender: ${user.gender || 'MALE'}, Qualification: ${user.educationLevel || user.education || 'N/A'}, Age: ${ageStr}, Category: ${user.category || 'GENERAL'}, State: ${user.domicileState || 'N/A'}, Height: ${userHeightCM > 0 ? userHeightCM + 'cm' : 'N/A'}`;

            const fullData = notification.fullData || notification.full_data || {};

            // Prune fullData to fit context window
            const prunedJobData = {
                title: jobTitle,
                eligibility: fullData.eligibility || fullData.structured_data?.eligibility,
                age_limit: fullData.age_limit || fullData.structured_data?.age_limit,
                physical_standard: fullData.physical_standard || fullData.structured_data?.physical_standard,
                vacancy_details: fullData.vacancy_details || fullData.structured_data?.vacancy_details,
                important_dates: fullData.important_dates || fullData.structured_data?.important_dates,
                who_can_apply: fullData.who_can_apply,
                extra_requirements: fullData.rule_map?.extra_requirements
            };

            const jobBrief = {
                title: jobTitle,
                description: (notification.description || "").substring(0, 300), // Truncate long descriptions
                fullData: prunedJobData
            };

            const educationFact = (report.applied_rules.find(r => r.module === 'EDUCATION') || report.failed_rules.find(r => r.module === 'EDUCATION'));
            const ageFact = (report.applied_rules.find(r => r.module === 'AGE') || report.failed_rules.find(r => r.module === 'AGE'));
            const physicalFact = (report.applied_rules.find(r => r.module === 'PHYSICAL') || report.failed_rules.find(r => r.module === 'PHYSICAL'));

            const facts = {
                overall_status: report.status,
                engine_decisions: {
                    education: educationFact ? { status: educationFact.status, user_qualification: educationFact.userHad, job_requirement: educationFact.requirement, friendly_msg: educationFact.message } : null,
                    age: ageFact ? { status: ageFact.status, user_age: report.age_analysis?.exact_age?.formatted, min_allowed: report.age_analysis.base_min_age, max_allowed: report.age_analysis.effective_max_age, friendly_msg: ageFact.message } : null,
                    physical: physicalFact ? { status: physicalFact.status, user_height: userHeightCM > 0 ? userHeightCM + 'cm' : 'N/A', required_height: physicalFact.requirement, friendly_msg: physicalFact.message } : null
                },
                extra_notes: report.extra_notes || [],
                missing_data: report.missing_data.map(r => r.message)
            };

            const istDate = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(new Date());

            const prompt = expertPrompt(userName, profileStr, facts, jobBrief, istDate);

            await LLMProvider.chatStream([{ role: 'user', content: prompt }], (chunk) => {
                onChunk(chunk);
            });
        } catch (error) {
            console.error("StreamDostAdvice Error:", error.message);
            onChunk("Bhai, thoda system load le raha hai, par tu check karte reh!");
        }
    }
}

module.exports = HumanExpertEngine;
