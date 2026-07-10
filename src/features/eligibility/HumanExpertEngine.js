const LLMProvider = require('../ai/generation/core_engine/llmProvider');
const expertPrompt = require('./prompts/expert_reasoning');
const UnitConverter = require('./utils/UnitConverter');

class HumanExpertEngine {
    /**
     * Converts raw eligibility data into a friendly "Dost" conversation.
     */
    static async generateDostAdvice(user, report, jobTitle, notification = {}, maxTokens = 350) {
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

            const facts = {
                overall_status: report.status,
                user_age: ageStr,
                age_limit: report.age_analysis?.effective_max_age,
                reasons: report.failed_rules.map(r => r.message),
                highlights: report.applied_rules.filter(r => r.module !== 'CORE').map(r => r.message),
                missing: report.missing_data.map(r => r.message),
                extra_info: report.extra_notes || []
            };

            const istDate = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(new Date());

            const prompt = expertPrompt(userName, profileStr, facts, jobBrief, istDate);

            // Call the LLM with high temperature for personality, but strict context for accuracy
            const chatRes = await LLMProvider.chat([{ role: 'user', content: prompt }], 0.1, { max_tokens: maxTokens });
            const response = chatRes?.content;

            if (response && typeof response === 'string') {
                // Clean up any bullet points if the LLM hallucinated them despite instructions
                const cleanResponse = response
                    .replace(/^<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/i, '')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && !line.startsWith('-') && !line.startsWith('*'))
                    .join('\n');

                if (cleanResponse.length > 0) return [cleanResponse];
                return [response.trim()];
            }

            return ["Bhai, jankari process nahi ho paayi. Ek baar details check kar lo."];
        } catch (error) {
            console.error("HumanExpertEngine Error:", error.message);
            return ["Bhai, abhi brain thoda busy hai. Manual report check kar lo niche."];
        }
    }

    /**
     * Generates a fast, rule-based advice without LLM for instant response.
     */
    static generateInstantAdvice(user, report, jobTitle) {
        const firstName = (user.name || "Dost").split(' ')[0];
        const status = report.status === 'ELIGIBLE' ? '✅' : '❌';
        const age = report.age_analysis?.exact_age?.formatted || "??";
        const edu = (user.educationLevel || user.education || 'N/A').toUpperCase();

        const bullets = [];

        // 1. Greeting & Basic Status
        if (report.status === 'ELIGIBLE') {
            bullets.push(`${status} ${firstName} bhai, tere liye mast khabar hai! Tu is job ke liye eligible hai.`);
        } else if (report.status === 'INCOMPLETE_PROFILE') {
            bullets.push(`⚠️ ${firstName} bhai, teri profile thodi adhuri hai. Details bharke check kar.`);
        } else {
            bullets.push(`${status} ${firstName} bhai, is job me teri baat banti dikh nahi rahi.`);
        }

        // 2. Core Logic (Age/Edu)
        const eduFail = report.failed_rules.find(r => r.module === 'EDUCATION');
        const ageFail = report.failed_rules.find(r => r.module === 'AGE');

        if (eduFail) {
            bullets.push(`Tu abhi ${edu} hai, par isme ${eduFail.requirement} manga hai.`);
        } else if (ageFail) {
            bullets.push(`Teri age (${age}) is job ki limit se bahar hai.`);
        } else {
            bullets.push(`Teri qualification (${edu}) aur age is job ke liye sahi hai.`);
        }

        // 3. Physicals/Category
        const physicalFail = report.failed_rules.find(r => r.module === 'PHYSICAL');
        if (physicalFail) {
            bullets.push(`Height/Chest me thodi dikat hai: ${physicalFail.message}`);
        } else {
            bullets.push(`Teri physical details aur category benefits ekdum sahi hain.`);
        }

        // 4. Action
        if (report.status === 'ELIGIBLE') {
            bullets.push(`Bhai deri mat kar, turant apply karde! Syllabus chahiye toh bol dena.`);
        } else {
            bullets.push(`Chinta mat kar, tera bhai tere liye dusri job dhund lega!`);
        }

        return bullets;
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

            const facts = {
                overall_status: report.status,
                user_age: ageStr,
                age_limit: report.age_analysis?.effective_max_age,
                reasons: report.failed_rules.map(r => r.message),
                highlights: report.applied_rules.filter(r => r.module !== 'CORE').map(r => r.message),
                missing: report.missing_data.map(r => r.message),
                extra_info: report.extra_notes || []
            };

            const istDate = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(new Date());

            const prompt = expertPrompt(userName, profileStr, facts, jobBrief, istDate);

            await LLMProvider.chatStream([{ role: 'user', content: prompt }], (chunk) => {
                onChunk(chunk);
            }, { temperature: 0.1 });
        } catch (error) {
            console.error("StreamDostAdvice Error:", error.message);
            onChunk("Bhai, thoda system load le raha hai, par tu check karte reh!");
        }
    }
}

module.exports = HumanExpertEngine;
