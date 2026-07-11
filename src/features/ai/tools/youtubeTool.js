/**
 * YouTube Educational Search Tool
 * Responsibility: Find the best educational videos on YouTube for a given topic.
 */

class YouTubeTool {
    static async search(topic) {
        try {
            const query = encodeURIComponent(`${topic} educational tutorial hindi`);
            const searchUrl = `https://www.youtube.com/results?search_query=${query}`;

            return {
                success: true,
                message: `Bhai, ${topic} ke liye ye best videos hain.`,
                youtube_link: searchUrl,
                advice: "Bhai, top 3 videos dekh lena, kaafi accha samjhaya hai."
            };
        } catch (error) {
            console.error("❌ YouTube Search Error:", error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = YouTubeTool;
