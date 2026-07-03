module.exports = {
    DEFAULT_RUNPOD_URL: "http://127.0.0.1:11434/api/chat",

    // 1. INTENT & PLANNER ENGINE (Fast & Logical Architect)
    // Using 0.5b for speed - if logic fails, switch back to 7b or 1.5b
    AI_LOGIC_MODEL: "qwen2.5:0.5b",

    // 2. PERSONALITY ENGINE (Heavy Synthesis & High-Impact Voice)
    AI_PERSONALITY_MODEL: "qwen2.5:7b",

    // 3. REASONING ENGINE (Deep Career Analysis)
    AI_REASONING_MODEL: "qwen2.5:7b",

    // 4. VERIFICATION ENGINE
    AI_VERIFY_MODEL: "qwen2.5:7b",

    // 5. SECURITY GUARD
    AI_GUARD_MODEL: "qwen2.5:0.5b"
};
