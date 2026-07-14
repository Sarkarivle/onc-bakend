/**
 * Local Resource Finder Tool
 * Responsibility: Find local libraries, coaching centers, or cyber cafes.
 */

class LocalResourceTool {
    static async find(resourceType, location) {
        try {
            const query = encodeURIComponent(`${resourceType} near ${location}`);
            const mapUrl = `https://www.google.com/maps/search/${query}`;

            return {
                success: true,
                message: `Bhai, ${location} mein ye rahe tere kaam ke ${resourceType} links.`,
                map_url: mapUrl,
                evidence: [{
                    title: `${resourceType} near ${location}`,
                    source: 'Google Maps search',
                    sourceUrl: mapUrl,
                    verified: false,
                    confidence: 0.65,
                    note: 'Map listing details should be checked before visiting.'
                }]
            };
        } catch (error) {
            console.error("❌ Local Resource Search Error:", error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = LocalResourceTool;
