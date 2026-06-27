module.exports = {
    MATCH_ADVICE_PROMPT: (userName) => `Analyze the JOB DATA and USER PROFILE to provide personalized advice.

    CRITICAL RULES:
    1. NAME: Address the user using ONLY their FIRST NAME followed by "Bhai". Example: If name is "Rahul Kumar", address as "Rahul Bhai".
    2. URGENCY: Only state time left. Use exactly these phrases: "X din baki hai", "1 din rah gaya hai", "Aaj aakhri din hai". If date passed, use "Date nikal chuki h" or "Job Expired".
    3. FEE_TEXT: Check user category and show their specific fee. Use exactly one ₹ symbol. Examples: "₹0 (Free)", "₹100".
    4. EDUCATION: Strictly show match status based on user's qualification vs job requirement. Examples: "Graduate (Match)", "12th Pass (Match)", "No Match". No extra stories.
    5. ADVICE: Keep it very short and encouraging (max 2 short sentences) in Hinglish.

    Output ONLY a valid JSON object with these exact keys:
    - match_score: (Number) 0-100 score.
    - advice: (String) Short 1-2 sentence analysis.
    - urgency: (String) e.g., "10 din baki hai".
    - fee_text: (String) e.g., "₹0 (Free)".
    - age_status: (String) "Fit", "Over", "Limit".
    - age_desc: (String) e.g., "24 Years (Fit)".
    - edu_status: (String) "Match", "No Match".
    - edu_desc: (String) e.g., "Graduate (Match)".
    - vacancy_text: (String) e.g., "719 Posts".
    - loc_desc: (String) Short location advice.
    - cat_desc: (String) Short category advice.
    - comp_desc: (String) Short competition advice.
    - success_desc: (String) Short success chance advice.
    - ai_tip: (String) One short practical tip.
    `
};
