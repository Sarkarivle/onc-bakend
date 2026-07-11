/**
 * CitationBuilder Tool
 * Responsibility: Generating citations/bibliography for assignments.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');

class CitationBuilder {
    /**
     * Generates a citation for a given source.
     */
    static async build({ source_link, source_title, author, year, format = 'APA' }) {
        console.log(`📚 CitationBuilder: Creating ${format} citation for ${source_title || source_link}...`);

        const prompt = `You are a Bibliography Expert.
Source Details:
- Title: ${source_title || 'Unknown'}
- Link: ${source_link || 'N/A'}
- Author: ${author || 'Unknown'}
- Year: ${year || 'Recent'}
- Target Format: ${format}

Task: Generate a perfectly formatted citation in ${format} style.

Output ONLY JSON:
{
  "citation": "...",
  "format": "${format}"
}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            return {
                success: true,
                citation: result.citation,
                format: result.format
            };
        } catch (e) {
            console.error("❌ CitationBuilder Error:", e.message);
            return { success: false, error: "Bhai, citation nahi ban payi. Source details ek baar check kar lo." };
        }
    }
}

module.exports = CitationBuilder;
