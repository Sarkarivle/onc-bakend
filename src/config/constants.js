module.exports = {
    DEFAULT_RUNPOD_URL: "http://127.0.0.1:11434/api/chat",

    // 1. ULTRA-FAST LOGIC ENGINE (Intent & Planning)
    // Best: qwen2.5:0.5b (Fastest, <500ms response)
    AI_LOGIC_MODEL: "qwen2.5:0.5b",

    // 2. PERSONALITY ENGINE (Heavy Synthesis)
    // Use 14b for high-quality Hinglish and instruction following
    AI_PERSONALITY_MODEL: "qwen3:14b",

    // 3. REASONING ENGINE (Complex Career Guidance)
    AI_REASONING_MODEL: "qwen3:14b",

    // 4. VERIFICATION ENGINE
    AI_VERIFY_MODEL: "qwen2.5:0.5b",

    // 5. SECURITY GUARD
    AI_GUARD_MODEL: "qwen2.5:0.5b"
};
