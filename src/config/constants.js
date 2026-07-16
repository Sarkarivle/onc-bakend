module.exports = {
    DEFAULT_RUNPOD_URL: "https://api.groq.com/openai/v1/chat/completions",
    DEFAULT_GROQ_MODEL: "openai/gpt-oss-120b",

    // 1. INTENT & PLANNER ENGINE (JSON logic, tool-arg extraction — needs to be accurate,
    // not just fast, since malformed args cause tool-calling failures downstream)
    AI_LOGIC_MODEL: process.env.AI_LOGIC_MODEL || "openai/gpt-oss-20b",

    // 2. PERSONALITY ENGINE (main chat/answer generation — strongest available reasoning +
    // function-calling model on Groq today; closest fit to a Gemini/GPT-4-class feel)
    AI_PERSONALITY_MODEL: process.env.AI_PERSONALITY_MODEL || "openai/gpt-oss-120b",

    // 3. REASONING ENGINE
    AI_REASONING_MODEL: process.env.AI_REASONING_MODEL || "openai/gpt-oss-120b",

    // 4. VERIFICATION ENGINE
    AI_VERIFY_MODEL: process.env.AI_VERIFY_MODEL || "openai/gpt-oss-20b",

    // 5. SECURITY GUARD
    AI_GUARD_MODEL: process.env.AI_GUARD_MODEL || "openai/gpt-oss-20b",

    // 6. VISION ENGINE (only vision-capable function-calling model on Groq)
    AI_VISION_MODEL: process.env.AI_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"
};
