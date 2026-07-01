/**
 * Calculator Tool
 * Responsibility: Performs safe mathematical operations.
 */
class Calculator {
    static execute(expression) {
        try {
            // Remove any non-mathematical characters for safety
            const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
            // Using Function constructor as a simple sandbox for math
            // In production, use a library like mathjs
            const result = new Function(`return ${sanitized}`)();
            return {
                success: true,
                expression: sanitized,
                result: result
            };
        } catch (error) {
            return {
                success: false,
                error: "Invalid expression"
            };
        }
    }
}

module.exports = Calculator;
