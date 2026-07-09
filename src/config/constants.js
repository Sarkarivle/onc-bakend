module.exports = {
    DEFAULT_RUNPOD_URL: "https://api.groq.com/openai/v1/chat/completions",
    DEFAULT_GROQ_MODEL: "llama-3.3-70b-versatile",

    // 1. INTENT & PLANNER ENGINE (Small & Fast for high rate limits)
    AI_LOGIC_MODEL: "llama-3.1-8b-instant",

    // 2. PERSONALITY ENGINE (Large & Smart for best Hinglish)
    AI_PERSONALITY_MODEL: "llama-3.3-70b-versatile",

    // 3. REASONING ENGINE
    AI_REASONING_MODEL: "llama-3.3-70b-versatile",

    // 4. VERIFICATION ENGINE
    AI_VERIFY_MODEL: "llama-3.1-8b-instant",

    // 5. SECURITY GUARD
    AI_GUARD_MODEL: "llama-3.1-8b-instant",

    // 6. VISION ENGINE
    AI_VISION_MODEL: "meta-llama/llama-4-scout-17b-16e-instruct"
};
