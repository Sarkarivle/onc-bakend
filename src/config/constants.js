module.exports = {
    DEFAULT_RUNPOD_URL: "http://127.0.0.1:11434/api/chat",
    // 1. LOGIC ENGINE (JSON & Classification Expert)
    AI_LOGIC_MODEL: "qwen2.5:7b",
    // 2. PERSONALITY ENGINE (Your Trained Model)
    AI_PERSONALITY_MODEL: "Lora_v1:latest",
    // 3. REASONING ENGINE (Complex Career Guidance)
    AI_REASONING_MODEL: "deepseek-r1:8b",
    // 4. VERIFICATION ENGINE (Fact & Accuracy Checker)
    AI_VERIFY_MODEL: "llama3.1:8b",
    // 5. SECURITY GUARD (Safety & Ethics Filter)
    AI_GUARD_MODEL: "llama-guard3"
};
