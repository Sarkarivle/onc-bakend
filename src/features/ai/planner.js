/**
 * Planner Module
 * Responsibility: Decide the execution strategy for the request.
 *
 * Rules:
 * - Never generates prompts.
 * - Only makes decisions.
 * - Returns a structured Decision Object.
 */
class Planner {
    /**
     * @param {string} query - The rewritten query.
     * @param {string[]} intents - Detected intents from IntentDetector.
     * @returns {Object} Decision Object
     */
    static plan(query, intents) {
        const q = query.toLowerCase();

        // 1. Identify primary intent
        const primaryIntent = intents.length > 0 ? intents[intents.length - 1] : "GENERAL_QUESTION";

        // 2. Determine Formatting requirement
        let formatting = "Standard";
        if (intents.some(i => ['GREETING', 'THANKS', 'GOODBYE', 'SMALL_TALK'].includes(i))) {
            formatting = "Short";
        } else if (intents.some(i => ['GOVT_JOB', 'CAREER', 'SCHOLARSHIP', 'STUDENT_GUIDANCE'].includes(i))) {
            formatting = "Detailed";
        } else if (q.includes('compare') || q.includes('versus') || q.includes('vs') || q.includes('difference')) {
            formatting = "Table";
        }

        // 3. Search Decision Logic
        const searchTriggers = ['SEARCH', 'LATEST_VACANCY', 'NEWS', 'GOVT_JOB', 'RESULT', 'ADMIT_CARD'];
        const needsSearch = intents.some(intent => searchTriggers.includes(intent)) ||
                           q.includes('latest') || q.includes('current') || q.includes('2024') || q.includes('kab aayega');

        // 4. Memory Decision
        // Memory is needed unless it's a completely fresh greeting or standalone simple fact
        const needsMemory = !intents.includes('GREETING') || intents.length > 1;

        // 5. Reasoning Decision
        // Reasoning is skipped for simple social interactions
        const needsReasoning = !(['GREETING', 'THANKS', 'GOODBYE', 'SMALL_TALK'].includes(primaryIntent) && intents.length === 1);

        // 6. Map Intents to Priority Prompt Modules
        // We ensure 'CORE' and 'PERSONALITY' are always present
        const priorityModules = ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'];

        // Add domain modules based on intents
        intents.forEach(intent => {
            if (!priorityModules.includes(intent)) {
                priorityModules.push(intent);
            }
        });

        // Ensure specific logic modules are included if needed
        if (needsReasoning) priorityModules.push('REASONING');
        if (needsSearch) priorityModules.push('SEARCH_DECISION');

        return {
            intent: primaryIntent,
            needSearch: needsSearch,
            needMemory: needsMemory,
            needReasoning: needsReasoning,
            needFormatting: formatting,
            priorityModules: priorityModules
        };
    }
}

module.exports = Planner;
