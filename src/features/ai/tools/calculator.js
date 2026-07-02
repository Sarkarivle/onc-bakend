/**
 * Calculator Tool
 * Responsibility: Performs safe mathematical operations.
 */
class Calculator {
    static execute(expression) {
        try {
            const sanitized = String(expression || '').replace(/[^0-9+\-*/().\s]/g, '').trim();
            if (!sanitized || sanitized.length > 120) throw new Error("Invalid expression");
            if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) throw new Error("Invalid characters");
            const result = this._evaluate(sanitized);
            if (!Number.isFinite(result)) throw new Error("Invalid result");
            return {
                success: true,
                expression: sanitized,
                result
            };
        } catch (error) {
            return {
                success: false,
                error: "Invalid expression"
            };
        }
    }

    static _evaluate(expression) {
        const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/()]|\S/g) || [];
        let index = 0;

        const parseExpression = () => {
            let value = parseTerm();
            while (tokens[index] === '+' || tokens[index] === '-') {
                const operator = tokens[index++];
                const right = parseTerm();
                value = operator === '+' ? value + right : value - right;
            }
            return value;
        };

        const parseTerm = () => {
            let value = parseFactor();
            while (tokens[index] === '*' || tokens[index] === '/') {
                const operator = tokens[index++];
                const right = parseFactor();
                value = operator === '*' ? value * right : value / right;
            }
            return value;
        };

        const parseFactor = () => {
            const token = tokens[index++];
            if (token === '-') return -parseFactor();
            if (token === '+') return parseFactor();
            if (token === '(') {
                const value = parseExpression();
                if (tokens[index++] !== ')') throw new Error("Unmatched parenthesis");
                return value;
            }
            const value = Number(token);
            if (!Number.isFinite(value)) throw new Error("Invalid number");
            return value;
        };

        const result = parseExpression();
        if (index !== tokens.length) throw new Error("Unexpected token");
        return result;
    }
}

module.exports = Calculator;
