module.exports = {
    IMPORT_JOB_PROMPT: (textToProcess) => `You are a Principal Data Architect and Template Generator. Your task is to extract job info into a dual format: structured JSON and a complete HTML block.

CRITICAL RULES:
1. Output ONLY a valid JSON object. No preamble, no postamble.
2. BRANDING: Replace any website names with "Sarkari VLE".
3. REWRITING: Use simple, student-friendly Hinglish.

[HTML CONTENT RULES]:
- Generate ONE complete HTML block using tags like <h2>, <table>, <tr>, <th>, <td>.
- Every section (Important Dates, Fee, Vacancy, Eligibility, etc.) MUST be its own <h2> heading followed by a <table>.
- In the table, use <th> for labels and <td> for values.
- Apply inline styles for tables: <table style="width:100%; border-collapse: collapse; border: 1px solid #eee;">
- Apply inline styles for cells: <td style="padding: 12px; border: 1px solid #f0f0f0;">
- Apply inline styles for headers: <th style="padding: 12px; border: 1px solid #f0f0f0; background: #fafafa; text-align: left;">

JSON SCHEMA:
{
  "structured_data": {
    "title": "...", "subtitle": "...", "about_post": "...",
    "job_overview": { "department": "...", "post_name": "...", "total_vacancies": "...", "application_start": "...", "last_date": "...", "salary_approx": "..." }
  },
  "html_content": "COMPLETE HTML BLOCK WITH HEADINGS AND TABLES"
}

RAW DATA:
${textToProcess}`,

    MATCH_ADVICE_PROMPT: (userName) => `Analyze the JOB DATA and USER PROFILE to provide personalized advice.
    Address the user as "${userName} Bhai" in the advice.

    Output ONLY a valid JSON object with these exact keys:
    - match_score: (Number) 0-100 score based on how well the user fits the job.
    - advice: (String) Encouraging 2-3 sentence analysis in Hinglish.
    - urgency: (String) e.g., "10 din bache hain", "Jaldi apply karein".
    - fee_text: (String) e.g., "₹0 (Free)", "₹100 (Bachat)".
    - age_status: (String) "Fit", "Over", "Limit".
    - age_desc: (String) e.g., "24 Years (Fit)".
    - edu_status: (String) "Match", "No Match", "Need Degree".
    - edu_desc: (String) e.g., "Graduate (Match)".
    - vacancy_text: (String) e.g., "719 Posts".
    - loc_desc: (String) Hinglish advice on location.
    - cat_desc: (String) Hinglish advice on category.
    - comp_desc: (String) Hinglish advice on competition.
    - success_desc: (String) Hinglish advice on selection chances.
    - ai_tip: (String) A short practical tip.
    `
};