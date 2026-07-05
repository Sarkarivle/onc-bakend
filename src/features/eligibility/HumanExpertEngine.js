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
            const ageStr = report.age_analysis?.exact_age?.formatted || "N/A";
            const userHeightCM = UnitConverter.heightToCM(user.height);

            const profileStr = `Name: ${userName}, Gender: ${user.gender || 'Not specified'}, Qualification: ${user.educationLevel || user.education || 'N/A'}, Age: ${ageStr}, Category: ${user.category || 'GENERAL'}, State: ${user.domicileState || 'N/A'}, Height: ${userHeightCM > 0 ? userHeightCM + 'cm' : 'N/A'}`;

            // Provide more context from notification for deeper logic
            const jobBrief = {
                title: jobTitle,
                description: notification.description || "",
                fullData: notification.fullData || notification.full_data || {}
            };

            const facts = {
                overall_status: report.status,
                age_details: report.age_analysis,
                failed_reasons: report.failed_rules.map(r => r.message),
                passed_details: report.applied_rules.map(r => r.message),
                missing_info: report.missing_data.map(r => r.message),
                extra_notes: report.extra_notes || [],
                job_requirements: {
                    education: (report.applied_rules.find(r => r.module === 'EDUCATION') || report.failed_rules.find(r => r.module === 'EDUCATION'))?.requirement || "Not clearly specified",
                    physical: (report.applied_rules.find(r => r.module === 'PHYSICAL') || report.failed_rules.find(r => r.module === 'PHYSICAL'))?.requirement || "Standard"
                }
            };

            const istDate = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(new Date());

            const prompt = expertPrompt(userName, profileStr, facts, jobBrief, istDate);

            // Call the LLM to get the human-friendly reasoning (Using Chat for personality and text output)
            const chatRes = await LLMProvider.chat([{ role: 'user', content: prompt }]);
            const response = chatRes?.content;

            if (response && typeof response === 'string') {
                // Parse bullet points into an array
                const points = response
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.replace(/^-\s*\[POINT\]\s*/i, '').replace(/^- /i, '').replace(/^✅\s*/, '✅ ').replace(/^❌\s*/, '❌ ').trim());

                if (points.length > 0) return points;

                // Fallback if no bullet points found but we have a response
                return [response.replace(/^<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/i, '').trim().substring(0, 500)];
            }

            return ["Bhai, jankari process nahi ho paayi. Ek baar details check kar lo."];
        } catch (error) {
            console.error("HumanExpertEngine Error:", error.message);
            return ["Bhai, abhi brain thoda busy hai. Manual report check kar lo niche."];
        }
    }
}

module.exports = HumanExpertEngine;
