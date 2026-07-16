/**
 * StreamingEngine Module — SSE streaming with chunk validation
 */
const ValidationEngine = require('../quality/validationEngine');

class StreamingEngine {
    constructor(res, options = {}) {
        this.res = res;
        this.buffer = [];
        // Turbo Speed: Use 1 as default buffer size for instant delivery
        this.bufferSize = options.turbo ? 1 : (options.bufferSize || 1);
        this.skipValidation = options.turbo || false;
        this.isCancelled = false;
        this.startTime = Date.now();
        this.metrics = { ttft: 0, tokenCount: 0, startTime: Date.now() };

        this._setupResponse();
    }

    _setupResponse() {
        this.res.setHeader('Content-Type', 'text/event-stream');
        this.res.setHeader('Cache-Control', 'no-cache');
        this.res.setHeader('Connection', 'keep-alive');
        this.res.setHeader('X-Accel-Buffering', 'no'); // Crucial for instant streaming
        this.res.on('close', () => { this.cancelStream('Client disconnected'); });
    }

    emit(event, data) {
        if (this.isCancelled) return;
        this.res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
    }

    startThinking(message) { this.emit('thinking', { status: message }); }
    toolStarted(tool, purpose) { this.emit('tool_started', { tool, purpose }); }
    toolFinished(tool, success) { this.emit('tool_finished', { tool, success }); }

    async pushChunk(token) {
        if (this.isCancelled || !token) return;

        if (this.metrics.tokenCount === 0) {
            this.metrics.ttft = Date.now() - this.startTime;
            this.emit('stream_start', { ttft: this.metrics.ttft });
        }

        this.buffer.push(token);
        this.metrics.tokenCount++;

        if (this.buffer.length >= this.bufferSize) {
            await this._flushBuffer();
        }
    }

    async _flushBuffer() {
        if (this.buffer.length === 0) return;
        const chunk = this.buffer.join('');

        // Turbo Mode: Skip expensive validation for trusted routes
        if (!this.skipValidation) {
            const safety = ValidationEngine.validateStreamChunk(chunk);
            if (safety.status === 'KILL') {
                this.cancelStream(`Safety violation: ${safety.reason}`);
                return;
            }
        }

        this.emit('token', { chunk });
        this.buffer = [];
    }

    async finishStream(metadata = {}) {
        await this._flushBuffer();
        this.emit('stream_complete', { duration: Date.now() - this.startTime, ...metadata });
        this.res.write('data: [DONE]\n\n');
        this.res.end();
    }

    cancelStream(reason) {
        if (this.isCancelled) return;
        this.isCancelled = true;
        this.emit('stream_cancelled', { reason });
        this.res.end();
    }

    error(err) {
        this.emit('error', { message: err.message });
        this.res.end();
    }
}

module.exports = StreamingEngine;
