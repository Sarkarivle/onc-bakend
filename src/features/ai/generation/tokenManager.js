/**
 * TokenManager Module
 * Responsibility: Budgeting and context pruning based on priority.
 */

class TokenManager {
    static BUDGETS = {
        TOTAL: 4096,
        SYSTEM: 2048,
        HISTORY: 1024,
        RAG: 1024
    };

    /**
     * Estimates tokens (Approx: 4 chars = 1 token for English/Hinglish).
     */
    static estimate(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    /**
     * Prunes context blocks based on priority.
     * Priority (High to Low): RAG -> History -> Memory -> Profile
     */
    static prune(blocks, budget) {
        let currentTotal = blocks.reduce((sum, b) => sum + this.estimate(b.content), 0);

        if (currentTotal <= budget) return blocks;

        // Sort by priority (ascending for removal)
        const sorted = [...blocks].sort((a, b) => a.priority - b.priority);

        for (const block of sorted) {
            if (currentTotal <= budget) break;

            const tokens = this.estimate(block.content);
            block.content = ""; // Remove block
            currentTotal -= tokens;
        }

        return blocks.filter(b => b.content !== "");
    }
}

module.exports = TokenManager;
