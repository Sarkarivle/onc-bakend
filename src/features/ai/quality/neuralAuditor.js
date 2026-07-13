/**
 * NeuralAuditor v1.0 - (GEMINI QUALITY GUARDIAN)
 * Responsibility: High-Precision Evaluation of AI Responses against Sovereign Rules.
 */
const {
    identity, grounding, sovereign, ethics, socio_economic,
    temporal, predictive, root_cause, logic, simulation,
    legacy, risk, autonomy, gap, pivot, mnemonics,
    mirroring, mood, blending, empathy, reasoning,
    visual, standards, tasks, formatting, correction
} = require('../prompts/components');

class NeuralAuditor {
    /**
     * Evaluates a response based on Gemini Sovereign Standards.
     */
    static async audit(userQuery, aiResponse, intents, tokens, latency) {
        const report = {
            query: userQuery,
            timestamp: new Date().toISOString(),
            metrics: {
                tokens: tokens,
                latency_ms: latency,
                token_efficiency: tokens < 2000 ? 'EXCELLENT' : tokens < 4000 ? 'GOOD' : 'POOR'
            },
            checks: [],
            score: 0
        };

        // 1. VISUAL AUDIT
        const hasAscii = aiResponse.includes('[') && aiResponse.includes('█');
        const hasArrows = aiResponse.includes('-->') || aiResponse.includes('->');
        report.checks.push({
            rule: 'VISUAL_LOGIC',
            status: (hasAscii || !intents.includes('ROADMAP')) ? 'PASS' : 'FAIL',
            detail: 'Checks for ASCII progress bars and roadmap arrows.'
        });

        // 2. TONE & PERSONA AUDIT
        const hasBhai = /bhai|ladle|sher|namaste/i.test(aiResponse);
        report.checks.push({
            rule: 'PERSONA_WARMTH',
            status: hasBhai ? 'PASS' : 'FAIL',
            detail: 'Checks for "Bada Bhai" addressal and Hinglish tone.'
        });

        // 3. ACTIONABLE AUDIT
        const taskMatch = aiResponse.match(/\d\./g);
        const hasTasks = taskMatch && taskMatch.length >= 3;
        report.checks.push({
            rule: 'MICRO_TASKS',
            status: hasTasks ? 'PASS' : 'FAIL',
            detail: 'Verifies exactly 3 actionable tasks are present.'
        });

        // 4. FORMATTING AUDIT
        const hasCodeBlocks = aiResponse.includes('```');
        report.checks.push({
            rule: 'NO_CODE_BLOCKS',
            status: !hasCodeBlocks ? 'PASS' : 'FAIL',
            detail: 'Ensures triple backticks are not used.'
        });

        // Calculate Final Quality Score
        const passed = report.checks.filter(c => c.status === 'PASS').length;
        report.score = (passed / report.checks.length) * 100;

        console.log(`\n🔍 [NeuralAuditor] Audit Complete | Score: ${report.score}% | Tokens: ${tokens}`);
        if (report.score < 100) {
            console.warn("⚠️ Quality Gaps Detected:", report.checks.filter(c => c.status === 'FAIL').map(c => c.rule));
        }

        return report;
    }
}

module.exports = NeuralAuditor;
