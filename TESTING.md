# AI Regression and Release Testing

To protect AI safety, brain foundation, and live conversational behavior, follow these testing procedures before any deployment.

## ⚠️ Critical Warning
**DO NOT** deploy AI changes unless:
1. `npm run test:all` passes.
2. `npm run test:brain` passes.
3. `npm run test:live-ai` passes (tested against VPS or live backend).

## Test Commands

### Normal Local Test (Pre-commit)
Runs all unit and integration tests (intents, conversation, responses, safety, data, performance, and brain).
```bash
npm run test:release
```

### VPS Live Release Test
Runs the live AI evaluation suite against a running backend. This requires the backend to be active and connected to the LLM provider.
```bash
# Replace URL with your VPS or local endpoint
LIVE_AI_URL=http://localhost:3001/api/v1/ai/ask npm run test:live-ai
```

### Full VPS Release Pipeline
Run this on the VPS before finalizing a release to ensure 100% regression lock.
```bash
npm run test:all
npm run test:brain
LIVE_AI_URL=http://localhost:3001/api/v1/ai/ask npm run test:live-ai
```
or use the combined script (requires environment variable):
```bash
LIVE_AI_URL=http://localhost:3001/api/v1/ai/ask npm run test:release-live
```
