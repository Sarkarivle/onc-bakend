module.exports = {
    DEFAULT_RUNPOD_URL: "http://127.0.0.1:11434/api/generate",
    AI_MODEL_NAME: "qwen2.5:7b",

    // 1. INTENT & PLANNER ENGINE (Fast & Logical Architect)
    // qwen2.5:1.5b is the sweet spot for logic and speed (< 1-2s)
    AI_LOGIC_MODEL: "qwen2.5:1.5b",

    // 2. PERSONALITY ENGINE (Heavy Synthesis & High-Impact Voice)
    AI_PERSONALITY_MODEL: "qwen2.5:7b",

    // 3. REASONING ENGINE (Deep Career Analysis)
    AI_REASONING_MODEL: "qwen2.5:7b",

    // 4. VERIFICATION ENGINE
    AI_VERIFY_MODEL: "qwen2.5:7b",

    // 5. SECURITY GUARD
    AI_GUARD_MODEL: "qwen2.5:0.5b"
};
