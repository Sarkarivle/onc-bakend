/**
 * ExamCenterLocator Tool
 * Responsibility: Helping students find their exam center and travel details.
 */
const WebSearchTool = require('./webSearchTool');

class ExamCenterLocator {
    /**
     * Locates exam center and provides travel estimation.
     */
    static async locate({ center_name, user_location }) {
        console.log(`🗺️ CenterLocator: Finding ${center_name} from ${user_location}...`);

        if (!center_name) return { success: false, error: "Bhai, center ka naam toh batao." };

        const query = `${center_name} location and directions from ${user_location || 'my location'}`;

        try {
            const searchResult = await WebSearchTool.search(query);

            // In a real app, we would use Google Maps API.
            // For now, we extract info from search results.

            return {
                success: true,
                center: center_name,
                search_info: searchResult.results ? searchResult.results[0] : null,
                travel_tip: "Bhai, exam ke din traffic ho sakta hai, toh 1 ghanta pehle nikalna safe rahega. Google Maps link search results mein check kar lo.",
                maps_link: `https://www.google.com/maps/search/${encodeURIComponent(center_name)}`
            };
        } catch (e) {
            console.error("❌ CenterLocator Error:", e.message);
            return { success: false, error: "Bhai, center ki location nahi mil rahi. Google Maps par manually dekh lo ek baar." };
        }
    }
}

module.exports = ExamCenterLocator;
