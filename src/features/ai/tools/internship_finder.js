/**
 * InternshipFinder Tool
 * Responsibility: Finding relevant and paid internships for students.
 */
const WebSearchTool = require('./webSearchTool');

class InternshipFinder {
    /**
     * Searches for internships based on field and location.
     */
    static async find({ field, location = 'Remote', type = 'Paid' }) {
        console.log(`💼 InternshipFinder: Searching for ${type} internships in ${field} (${location})...`);

        const query = `${type} internship for ${field} in ${location} 2024 2025 site:internshala.com OR site:linkedin.com OR site:naukri.com`;

        try {
            const searchResult = await WebSearchTool.search(query);

            if (!searchResult.success) {
                return { success: false, error: "Bhai, filhal koi nayi internship nahi mili. Thodi der baad try karein?" };
            }

            // Refine results (Simple filtering/formatting)
            const internships = searchResult.results.map(r => ({
                title: r.title,
                platform: r.source || "Web",
                link: r.link,
                snippet: r.snippet
            }));

            return {
                success: true,
                field,
                location,
                internships: internships.slice(0, 4),
                evidence: searchResult.evidence || [],
                message: `Bhai, tere field (${field}) mein ye kuch achhi internships mili hain.`
            };
        } catch (e) {
            console.error("❌ InternshipFinder Error:", e.message);
            return { success: false, error: "Bhai, internship search fail ho gayi. Dobara try karein?" };
        }
    }
}

module.exports = InternshipFinder;
