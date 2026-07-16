# 🧠 Jobo AI - Agentic Pipeline (Architecture v1.0)

Cognitive/agentic AI engine of ONC — an agentic tool-calling assistant for Indian students (career guidance, government jobs, exams, scholarships).

This document is kept in sync with the actual code. If you change the pipeline, update this file in the same commit.

---

## 🚀 The Request Journey (Execution Flow)

```text
User Query
   ↓
[1] SmartGateway.validate() — regex + local vector check: block/greet/proceed
   ↓
[2] SessionManager.getHistory() + UserProfile.get() — load last 10 turns + profile (parallel)
   ↓
[3] MasterOrchestrator.classifyIntent() — regex greeting fast-path, else LLM (AI_LOGIC_MODEL) intent JSON
   ↓
[4] MasterOrchestrator._selectTools() — pick tool set for the classified intent(s)
   ↓
[5] prompts/persona.js + prompts/index.js — assemble system prompt (persona + mode + memory block)
   ↓
[6] AgentLoop.run() — up to 3 tool-calling iterations against AI_PERSONALITY_MODEL:
       - iteration 1: tools offered, model may call search_jobs/calculators/etc.
       - tool results (full structured data, not just titles) fed back as context
       - final content-only turn streams token-by-token (ask-stream endpoint only)
   ↓
[7] EliteFormatter.format() — markdown/table cleanup, scam highlighting, verification footer
   ↓
[8] SessionManager.saveInteraction() + BackgroundServices.runAll() (fire-and-forget: fact
    extraction into long-term memory, used on the NEXT turn via the memory block in step 5)
   ↓
Final Response
```

---

## 📂 Folder Structure & Responsibilities

- **`orchestrator/`** — `aiOrchestrator.js` (request/response shaping, both `/ask` and `/ask-stream`), `MasterOrchestrator.js` (intent classification, tool selection, prompt assembly), `streamingEngine.js` (SSE), `telemetryEngine.js`, `backgroundServices.js`.
- **`reasoning/agentLoop.js`** — the actual tool-calling loop and LLM call sites (streaming + non-streaming).
- **`generation/core_engine/llmProvider.js`** — Groq-compatible HTTP client: model selection, `generateLogic` (JSON), `chat`, `chatStream`.
- **`knowledge/`** — `retrievalEngine.js` (job search/eligibility), `searchReranker.js` (LLM-based reranking of top candidates), `vectorService.js` (embeddings — see Tech Stack below).
- **`memory/`** — `SessionManager.js` (short-term chat history, Mongo-backed), `memoryEngine.js` (long-term fact extraction + retrieval, injected into the system prompt as `# RELEVANT MEMORIES`).
- **`context/userProfile.js`** — merges Auth `User` profile with session data; source of truth for personalization.
- **`prompts/`** — `persona.js` (real prompt assembler), `components/` (persona building blocks), `modes/` (per-intent expert prompt files).
- **`quality/`** — `smartGateway.js` (greeting/safety gate), `eliteFormatter.js` (output formatting), `grounding.js` (citation footer), `neuralAuditor.js` (console-only quality logging, non-blocking).
- **`tools/toolRegistry.js`** — tool JSON schemas + implementations (job search, calculators, PDF, image analysis, etc.).

---

## 🛠 Tech Stack

- **Inference:** Groq (OpenAI-compatible API). Models are set in `src/config/constants.js`, overridable via env vars (`AI_LOGIC_MODEL`, `AI_PERSONALITY_MODEL`, `AI_VISION_MODEL`, etc.) — no code change needed to swap models, including to a self-hosted GPU endpoint (`LLM_BASE_URL` + `LLM_PROVIDER=vllm`).
- **Embeddings:** `vectorService.js` defaults to a hash/n-gram local vector with a hand-tuned Hinglish synonym table (`EMBEDDING_PROVIDER=local_hash`, the default) — this beat a real sentence-transformer model on Hinglish similarity in testing. A real local model (`Xenova/all-MiniLM-L6-v2`, via `@xenova/transformers`, no external API) is available opt-in via `EMBEDDING_PROVIDER=local_minilm`, or a hosted OpenAI/Gemini embedding API via `EMBEDDING_PROVIDER=openai|gemini` + API key. Switching providers changes vector dimensionality — re-run `npm run vectors:jobs` after switching.
- **Database:** MongoDB (Mongoose). No vector index — semantic fallback search is brute-force cosine similarity over a Mongo-filtered candidate set (`retrievalEngine.js`).
- **Streaming:** SSE via `StreamingEngine`; the final content-only model turn streams token-by-token through `LLMProvider.chatStream`.

---

## 💡 Developer Guidelines

1. **Model changes go in `constants.js` / env vars**, not scattered hardcoded strings in `llmProvider.js`.
2. **Modular Prompts:** persona/tone rules live in `prompts/components/`; per-intent expertise lives in `prompts/modes/`. Keep new components free of contradictions with existing ones (check `identity.js`/`self_correction.js`/`persona.js`'s `RESPONSE PROTOCOL` before adding tone instructions).
3. **Tool results must reach the model.** If you add a new tool, make sure `AgentLoop.run`'s tool-feedback compaction doesn't drop the data the final answer needs to be grounded (see the `search_jobs` handling for the pattern to follow).
4. **Long-term memory** is read every turn via `MemoryEngine.searchMemory` and injected as `# RELEVANT MEMORIES` — if you change that header text, update `prompts/components/memory_personalization.js` to match.

---
**Mission:** *To build the most intelligent, well-grounded career assistant for every Indian aspirant — engineered honestly, not just described that way.*
