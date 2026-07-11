/**
 * DeepContentSummarizer Tool
 * Responsibility: Summarizing large texts, PDFs, or web pages into exam-ready bullet points.
 */
const axios = require('axios');
const cheerio = require('cheerio');
const LLMProvider = require('../generation/core_engine/llmProvider');

class DeepContentSummarizer {
    /**
     * Summarizes content from text or a URL.
     */
    static async summarize({ text, url, mode = 'EXAM_READY' }) {
        console.log(`📖 Summarizer: Processing ${url ? `URL: ${url}` : 'provided text'}...`);

        let contentToSummarize = text;

        if (url) {
            try {
                const response = await axios.get(url, { timeout: 10000 });
                const $ = cheerio.load(response.data);

                // Remove unwanted elements
                $('script, style, nav, footer, header, ads').remove();
                contentToSummarize = $('body').text().replace(/\s+/g, ' ').trim();

                // Truncate if too long for LLM (conservative limit)
                if (contentToSummarize.length > 15000) {
                    contentToSummarize = contentToSummarize.substring(0, 15000) + "...";
                }
            } catch (e) {
                console.error("❌ Summarizer: Failed to fetch URL content:", e.message);
                if (!text) return { success: false, error: "Bhai, main us link ka content nahi nikal paya. Kya aap text copy-paste kar sakte hain?" };
            }
        }

        if (!contentToSummarize || contentToSummarize.length < 50) {
            return { success: false, error: "Bhai, summarize karne ke liye content bohot chhota hai." };
        }

        const prompt = `You are an Expert Academic Summarizer.
User Goal: ${mode === 'EXAM_READY' ? 'Create Exam-Ready Summary' : 'General Summary'}
Content:
"""
${contentToSummarize}
"""

Instructions:
1. Start with a "One-Line Essence" (Bhai, ye content basically X ke baare mein hai).
2. Provide "Key Takeaways" in 5-7 bullet points.
3. If there are any dates, names, or formulas, list them separately as "Quick Facts".
4. Language: Mix of Hindi and English (Hinglish) - Brotherly tone.

Output format:
{
  "essence": "...",
  "bullets": ["...", "..."],
  "facts": ["...", "..."]
}`;

        try {
            const summaryData = await LLMProvider.generateLogic(prompt);
            return {
                success: true,
                summary: summaryData,
                wordCount: contentToSummarize.length
            };
        } catch (e) {
            console.error("❌ Summarizer LLM Error:", e.message);
            return { success: false, error: "Bhai, summary generate karne mein thodi dikkat hui. Ek baar fir try karein?" };
        }
    }
}

module.exports = DeepContentSummarizer;
