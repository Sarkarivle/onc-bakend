const LLMProvider = require('../ai/generation/core_engine/llmProvider');
const expertPrompt = require('./prompts/expert_reasoning');

class HumanExpertEngine {
    /**
     * Converts raw eligibility data into a friendly "Dost" conversation.
     */
    static async generateDostAdvice(user, report, jobTitle) {
        try {
            const userName = user.name || "Dost";
            const profileStr = `Qualification: ${user.education || 'N/A'}, Age: ${user.age || 'N/A'}, Category: ${user.category || 'GENERAL'}, State: ${user.domicileState || 'N/A'}`;

            const facts = {
                status: report.status,
                age: report.age_analysis?.exact_age?.formatted,
                failed_rules: report.failed_rules.map(r => ({ module: r.module, msg: r.message })),
                applied_rules: report.applied_rules.map(r => ({ module: r.module, msg: r.message })),
                missing_fields: report.missing_fields || [],
                extra_notes: report.extra_notes || []
            };

            const prompt = expertPrompt(userName, profileStr, facts, jobTitle);

            // Call the LLM to get the human-friendly reasoning
            const response = await LLMProvider.generateLogic(prompt);

            if (response && typeof response === 'string') {
                // Parse bullet points into an array
                return response
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.replace(/^-\s*\[POINT\]\s*/i, '').replace(/^- /i, '').trim());
            }

            return ["Bhai, jankari process nahi ho paayi. Ek baar details check kar lo."];
        } catch (error) {
            console.error("HumanExpertEngine Error:", error.message);
            return ["Bhai, abhi brain thoda busy hai. Manual report check kar lo niche."];
        }
    }
}

module.exports = HumanExpertEngine;
