/**
 * GrammarStyleChecker Tool
 * Responsibility: Improving tone and structure of user's writing (Emails, Assignments, Messages).
 */
const LLMProvider = require('../generation/core_engine/llmProvider');

class GrammarStyleChecker {
    /**
     * Checks and improves the grammar and style of the text.
     */
    static async check({ text, target_tone = 'Professional' }) {
        console.log(`✍️ GrammarChecker: Improving text in ${target_tone} tone...`);

        if (!text || text.length < 10) {
            return { success: false, error: "Bhai, check karne ke liye text toh do!" };
        }

        const prompt = `You are a Professional Editor and Tone Specialist.
Original Text: "${text}"
Target Tone: ${target_tone}

Instructions:
1. Fix all grammar and spelling errors.
2. Rewrite the text to match the ${target_tone} tone while keeping the original meaning.
3. Explain 1-2 major changes you made (in Hinglish).

Output ONLY JSON:
{
  "improved_text": "...",
  "changes_made": "...",
  "tone_score": 1-10
}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            return {
                success: true,
                original: text,
                improved: result.improved_text,
                explanation: result.changes_made,
                tone: target_tone
            };
        } catch (e) {
            console.error("❌ GrammarChecker Error:", e.message);
            return { success: false, error: "Bhai, text improve nahi ho paya. Ek baar phir likh kar bhejo." };
        }
    }
}

module.exports = GrammarStyleChecker;
