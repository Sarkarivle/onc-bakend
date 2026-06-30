# 🧠 Jobo AI - Neural Agentic Pipeline (Architecture v2.0)

Welcome to the **Cognitive Intelligence Engine** of ONC. This system has evolved from a simple keyword-based script to a multi-layered, neural AI agent inspired by top-tier players like Google Gemini and OpenAI.

---

## 🚀 The Request Journey (Execution Flow)

Every user query passes through a **10-Phase Neural Pipeline**:

```text
User Query
   ↓
[Phase 1] Smart Gateway (Local Embedding Check: Safety/Greeting)
   ↓
[Phase 2] Neural Refiner (Llama-3: Typos & Query Completion)
   ↓
[Phase 3] Intent Engine (Llama-3: Meaning & Entity Extraction)
   ↓
[Phase 4] Agentic Planner (Llama-3: Tool Selection & Strategy)
   ↓
[Phase 5] Retrieval Engine (Hybrid RAG: Vector + Semantic Search)
   ↓
[Phase 6] Search Reranker (Llama-3: Filtering the best 3 jobs)
   ↓
[Phase 7] Prompt Composer (Dynamic Assembly of Expert Modules)
   ↓
[Phase 8] LLM Chat (Runpod Llama-3: Final Answer Generation)
   ↓
[Phase 9] Neural Self-Critique (Audit & Hallucination Guard)
   ↓
[Phase 10] Elite Formatter (Markdown Tables & Personalized UI)
   ↓
Final Response + Neural Memory Update
```

---

## 📂 Folder Structure & Responsibilities

### 1. `orchestrator/` (The Controller)
- **`aiOrchestrator.js`**: The central nervous system. Manages the flow between all modules.

### 2. `intent/` (The Understanding Layer)
- **`normalizers/neuralRefiner.js`**: Uses AI to fix "ulti-seedhi" query inputs.
- **`detectors/llmDetector.js`**: Pure neural intent analysis (Returns JSON).
- **`prompts/`**: Specialist instructions for the refiner and detector.

### 3. `reasoning/` (The Brain)
- **`agenticPlanner.js`**: Decides *how* to answer (e.g., "Search DB" or "Direct Answer").
- **`knowledgeRouter.js`**: Decides which data sources to hit.

### 4. `knowledge/` (The Memory Access)
- **`vectorService.js`**: 100% Local embedding generation using `all-MiniLM-L6-v2`.
- **`retrievalEngine.js`**: Executes the search.
- **`searchReranker.js`**: AI-driven ranking of search results.

### 5. `generation/` (The Voice)
- **`llmProvider.js`**: Centralized adapter for Runpod GPU (Llama-3).
- **`promptComposer.js`**: Builds the final context for the AI.
- **`prompts/`**: Master modules for Government Jobs, Career, Resume, etc.

### 6. `quality/` (The Safety & Style)
- **`smartGateway.js`**: Local neural gatekeeper for safety and greetings.
- **`neuralValidator.js`**: Self-critique layer that prevents hallucinations.
- **`eliteFormatter.js`**: Converts raw text into professional Markdown tables and roadmaps.

### 7. `context/` (The Persistence)
- **`sessionState.js`**: Manages MongoDB conversation history.
- **`memoryManager.js`**: Extracts facts (Qualification, Location) to build a user profile.

---

## 🛠 Tech Stack
- **Inference Engine:** Runpod GPU (Llama-3-8B-Instruct).
- **Local Vectors:** `transformers.js` (@xenova/all-miniLM-L6-v2).
- **Database:** MongoDB (with Vector Search index).
- **Logic:** Node.js (Async/Await Pattern).

---

## 💡 Developer Guidelines
1. **No Keywords:** Do not add hardcoded regex for new features. Use `prompts/` and let the LLM handle the logic.
2. **Modular Prompts:** If you need to change how the AI speaks, edit the files in `generation/prompts/`.
3. **Local First:** Keep embedding generation local in `vectorService.js` to save GPU costs.
4. **Agentic Loops:** If a tool fails, use the `AgenticPlanner` to "pivot" and try a new strategy.

---
**Mission:** *To build the world's most intelligent career assistant for every Indian aspirant.*
