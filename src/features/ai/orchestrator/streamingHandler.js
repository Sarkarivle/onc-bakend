/**
 * StreamingHandler Module
 * Responsibility: Managing real-time token stream, line buffering, and final response replacement.
 */
const EliteFormatter = require('../quality/eliteFormatter');

class StreamingHandler {
    static async handle(llmStream, stream, meta) {
        const { intent, profile, onComplete } = meta;
        let fullContent = "";
        let lineBuffer = "";
        let totalPushedLength = 0;

        await llmStream(async (chunk) => {
            fullContent += chunk;
            lineBuffer += chunk;

            // Process line-by-line or on buffer overflow (100 chars)
            if (lineBuffer.includes('\n') || lineBuffer.length > 100) {
                const cleanedLine = this._cleanTags(lineBuffer);

                // Format the line to remove immediate stuttering
                const formattedLine = EliteFormatter.format(cleanedLine, {
                    intent,
                    userProfile: profile,
                    isFinal: false
                });

                if (formattedLine.trim()) {
                    await stream.pushChunk(formattedLine + (lineBuffer.includes('\n') ? '\n' : ''));
                }
                lineBuffer = "";
            }
        });

        // Final Flush
        if (lineBuffer.trim()) {
            const finalClean = this._cleanTags(lineBuffer);
            const finalFormatted = EliteFormatter.format(finalClean, { intent, userProfile: profile, isFinal: false });
            if (finalFormatted) await stream.pushChunk(finalFormatted);
        }

        // Generate the "Verified" Final Answer for replacement
        const finalProcessedContent = this._cleanTags(fullContent).trim();
        const verifiedAnswer = EliteFormatter.format(finalProcessedContent, {
            intent,
            userProfile: profile,
            isFinal: true
        });

        return { verifiedAnswer, fullContent };
    }

    static _cleanTags(text) {
        return text
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<think>[\s\S]*/gi, '')
            .replace(/<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/gi, '')
            .replace(/<AGENT_THOUGHT>[\s\S]*/gi, '')
            .replace(/<\/?USER_MESSAGE>/gi, '');
    }
}

module.exports = StreamingHandler;
