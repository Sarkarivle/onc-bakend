/**
 * Scholarship Deep Search Tool
 * Responsibility: Find specific scholarships based on user profile.
 */
const WebSearchTool = require('./webSearchTool');

class ScholarshipSearchTool {
    static async deepSearch(profile) {
        try {
            const query = `active scholarships for ${profile.category || ''} ${profile.gender || ''} students in ${profile.location || 'India'} ${profile.qualification || ''} 2024-25`;
            const results = await WebSearchTool.search(query);

            return {
                success: true,
                message: "Bhai, ye rahi kuch active scholarships tere liye.",
                results: results,
                evidence: results.evidence || [],
                grounding: {
                    official_portal: "https://scholarships.gov.in",
                    note: "Scholarship eligibility and dates change. Final check official portal par karo."
                },
                strategic_advice: "Bhai, official NSP portal (National Scholarship Portal) par bhi ek baar check kar lena."
            };
        } catch (error) {
            console.error("❌ Scholarship Search Error:", error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ScholarshipSearchTool;
