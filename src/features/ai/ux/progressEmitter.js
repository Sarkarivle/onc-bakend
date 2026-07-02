/**
 * ProgressEmitter Module
 * Responsibility: Emits user-friendly status updates to the UI via Socket.IO.
 */
class ProgressEmitter {
    static io = null;

    static setIO(ioInstance) {
        this.io = ioInstance;
    }

    static STAGE_MAP = {
        'REQUEST_RECEIVED': { hi: 'Message mila...', en: 'Message received...' },
        'INPUT_PROCESSING': { hi: 'Message samajh raha hoon...', en: 'Processing message...' },
        'CONVERSATION_STATE_LOADING': { hi: 'Pichhli baat dekh raha hoon...', en: 'Checking conversation history...' },
        'USER_PROFILE_LOADING': { hi: 'Profile check kar raha hoon...', en: 'Checking your profile...' },
        'INTENT_DETECTION': { hi: 'Sawal ka intent samajh raha hoon...', en: 'Identifying intent...' },
        'PLANNING': { hi: 'Best tareeka soch raha hoon...', en: 'Planning response...' },
        'DATABASE_CHECKING': { hi: 'Database check kar raha hoon...', en: 'Checking jobs database...' },
        'SEARCHING_VERIFIED_SOURCES': { hi: 'Verified source dekh raha hoon...', en: 'Searching verified sources...' },
        'PROMPT_COMPOSING': { hi: 'Answer ka context bana raha hoon...', en: 'Preparing answer context...' },
        'LLM_THINKING': { hi: 'Answer soch raha hoon...', en: 'Thinking...' },
        'RESPONSE_VALIDATION': { hi: 'Answer verify kar raha hoon...', en: 'Verifying answer...' },
        'RESPONSE_FORMATTING': { hi: 'Answer ready kar raha hoon...', en: 'Formatting response...' },
        'FINAL_RESPONSE_READY': { hi: 'Response bhej raha hoon...', en: 'Sending response...' },
        'ERROR': { hi: 'Thoda issue aa gaya...', en: 'Something went wrong...' }
    };

    static emit(sessionId, stage, lang = 'hi') {
        if (!this.io || !sessionId) return;
        const status = this.STAGE_MAP[stage] || { hi: 'Bas ek minute...', en: 'Thinking...' };
        const message = lang === 'hi' ? status.hi : status.en;

        this.io.to(sessionId).emit('ai_progress', {
            stage,
            message,
            timestamp: Date.now()
        });
    }
}

module.exports = ProgressEmitter;
