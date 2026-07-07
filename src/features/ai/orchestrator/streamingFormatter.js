/**
 * StreamingFormatter Module
 * Responsibility: Applying EliteFormatter logic to streaming chunks without causing duplication.
 */
const EliteFormatter = require('../quality/eliteFormatter');

class StreamingFormatter {
    static apply(fullTextSoFar, totalPushedLength, meta = {}) {
        // 1. Get the latest formatted version of the ENTIRE text
        // This ensures de-duplication and stutter-fixing applies to the whole context.
        const formattedFull = EliteFormatter.format(fullTextSoFar, meta);

        // 2. Identify the NEW part that hasn't been sent to the client yet
        let newChunk = '';
        if (formattedFull.length > totalPushedLength) {
            newChunk = formattedFull.substring(totalPushedLength);
        }

        return {
            formattedFull,
            newChunk,
            newTotalLength: formattedFull.length
        };
    }
}

module.exports = StreamingFormatter;
