module.exports = {
    IMPORT_JOB_PROMPT: (textToProcess) => `You are a strict, automated Data Extraction Engine for SarkariVLE.
Your ONLY task is to parse highly unstructured, messy raw text and convert it into a perfectly formatted, rigid JSON object.

CRITICAL PIPELINE RULES (DO NOT IGNORE):
1. NO PREAMBLE/NO POSTAMBLE: Output absolutely nothing except the JSON object. Do not say "Here is the JSON". Do not use markdown \`\`\`json code blocks. Start exactly with '{' and end exactly with '}'.
2. SYNTAX SAFETY: Ensure all string values are properly escaped (e.g., use \\" for quotes inside text). No trailing commas.
3. HANDLING MESSY DATA: The raw data is unstructured. Scan the entire text carefully. Infer missing headers from context.
4. REWRITING: NEVER copy exact sentences. Rewrite in clean, simple, student-friendly Hindi/English mix. Replace ANY third-party website names with "Sarkari VLE".
5. FALLBACKS: If a specific piece of information is completely missing, use null (boolean/type null, NOT the string "null") or an empty array []. DO NOT invent or hallucinate data.

JSON SCHEMA AND INSTRUCTIONS:
{
  "title": "String - Cleaned up job title. E.g., 'UP Police Constable Recruitment 2026'",
  "subtitle": "String - Board/Exam name. E.g., 'Uttar Pradesh Police Recruitment Board (UPPRPB)'",
  "about_post": "String - 2-3 line rewritten summary of the job and opportunity.",

  "job_overview": {
    "department": "String or null - Auto-detect from text",
    "post_name": "String or null - Auto-detect from text",
    "total_vacancies": "String or null - E.g., '60244' or 'Not Specified'",
    "application_start": "String or null - Format: DD-MMM-YYYY (e.g., 25-Aug-2026)",
    "last_date": "String or null - Format: DD-MMM-YYYY. Crucial field, scan carefully.",
    "salary_approx": "String or null - E.g., '₹21,700 - ₹69,100' or 'As per rules'"
  },

  "important_dates": [
    {
      "event": "String - e.g., 'Application Begin', 'Last Date', 'Exam Date'",
      "date": "String - e.g., '25-Aug-2026' or 'Available Soon'"
    }
  ],

  "application_fee": [
    {
      "category": "String - e.g., 'General / OBC / EWS', 'SC / ST'",
      "fee": "String - e.g., '₹400', 'Exempted'"
    }
  ],

  "age_limit": "String - Rewritten short summary of age limits and cutoff dates.",

  "age_relaxation": {
    "OBC": "String - Default to 'As per rules' if not specified",
    "SC": "String - Default to 'As per rules' if not specified",
    "ST": "String - Default to 'As per rules' if not specified",
    "Other_Categories": "String - Default to 'As per rules' if not specified"
  },

  "vacancy_details": [
    {
      "post_name": "String",
      "vacancies": "String",
      "eligibility": "String - Cleanly summarized qualifications"
    }
  ],

  "eligibility_summary": "String - Overall eligibility in 1-2 lines.",

  "physical_standard": [
    {
      "category": "String - e.g., 'Male (Gen/OBC/SC)', 'Female'",
      "details": "String - e.g., 'Height: 168 cm, Chest: 79-84 cm'"
    }
  ],

  "who_can_apply": "String - e.g., 'All India Candidates (Male/Female)'",

  "selection_process": [
    "String - Array of steps e.g., 'Written Exam', 'Physical Test'"
  ],

  "how_to_apply": [
    "String - Step 1",
    "String - Step 2"
  ],

  "important_notes": [
    "String - Note 1",
    "String - Note 2"
  ],

  "extra_sections": [
    {
      "section_title": "String",
      "content": "String"
    }
  ],

  "important_links": {
    "apply_online": "String - URL or 'Available Soon'",
    "notification": "String - URL or 'Click Here'",
    "short_notice": "String - URL or 'Click Here'",
    "official_website": "String - URL or 'Click Here'",
    "sarkarivle_app": "https://play.google.com/store/apps/details?id=com.blogpro.sarkarivle&hl=en_IN",
    "whatsapp_channel": "String - URL or 'Click Here'"
  },

  "faq": [
    {
      "question": "String - e.g., 'Q1. What is the last date?'",
      "answer": "String - e.g., 'Ans. The last date is...'"
    }
  ]
}

RAW UNSTRUCTURED DATA TO PARSE:
"""
${textToProcess}
"""`,

    MATCH_ADVICE_PROMPT: (userName) => `Address as "${userName} Bhai".
Current Date: ${new Date().toDateString()}
Evaluate Job vs User Profile strictly. Hinglish output.
JSON Fields:
1. "urgency": Calculate exactly how many days left from Today to the job's last date. E.g., "Sirf 3 din bache hain", "10 din baki hain".
2. "fee_text": Exact fee for user's category (e.g. "Tumhare liye ₹0 fee hai").
3. "age_status": "Fit", "Over", or "Kam".
4. "age_desc": User age vs job limit (e.g. "21 Years (Fit)").
5. "vacancy_text": Total posts.
6. "edu_status": "Match"/"No Match".
7. "edu_desc": Compare Education vs Eligibility.
8. "loc_desc": Location match status.
9. "cat_desc": Category vacancy status.
10. "comp_desc": Competition level (short sentence).
11. "success_desc": Probability of selection.
12. "ai_tip": 1 actionable tip.
13. "advice": 2-line summary.

Rule: Output ONLY raw JSON. No markdown.`,
};