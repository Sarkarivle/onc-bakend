module.exports = {
    IMPORT_JOB_PROMPT: (textToProcess) => `You are a Principal Data Architect and Template Generator. Your task is to extract job info into a structured JSON format.

CRITICAL RULES:
1. Output ONLY a valid JSON object. No preamble, no postamble.
2. BRANDING: Replace any website names with "Sarkari VLE".
3. REWRITING: Use simple, student-friendly Hinglish for summaries only.
4. ZERO-LOSS EXTRACTION: Every piece of information from the raw text MUST be present in the output. Do not skip Important Dates, Application Fees, Vacancy Details (Category wise/District wise), Eligibility, Age Limit, or How to Apply.
5. NO SUMMARIZATION: Do not replace complex tables with short sentences like "Check notification". Every row and column must be transcribed exactly as it appears in the source.
6. DATA FIDELITY: Your primary goal is accuracy. If the input has a table, the output MUST have that exact table data preserved in the JSON structure.
7. ALL COLUMNS MANDATORY: If a table has multiple columns in the source, it MUST have the same number of columns in the output. Do not merge, skip, or omit any columns.
8. NO JUDGMENT: Do not decide what is important. Every cell in every table provided in the raw data is important. Parse it all.

JSON SCHEMA:
{
  "structured_data": {
    "title": "Full Post Name",
    "subtitle": "Department/Organization Name",
    "about_post": "Short summary in Hinglish",
    "job_overview": {
      "department": "...",
      "post_name": "...",
      "total_vacancies": "...",
      "application_start": "...",
      "last_date": "...",
      "salary_approx": "..."
    },
    "important_dates": {
      "begin": "...",
      "last_date": "...",
      "fee_last_date": "...",
      "exam_date": "..."
    },
    "application_fee": {
      "gen_obc_ews": "...",
      "sc_st_ph": "...",
      "female": "..."
    },
    "eligibility": {
      "education": "Brief description",
      "min_age": "...",
      "max_age": "...",
      "age_limit_as_on": "..."
    },
    "vacancy_details": {
      "total": "...",
      "general": "...",
      "obc": "...",
      "ews": "...",
      "sc": "...",
      "st": "..."
    },
    "selection_process": {
      "mode": "...",
      "steps": "..."
    },
    "exam_details": {
      "exam_center": "...",
      "exam_mode": "...",
      "exam_date": "..."
    },
    "how_to_apply": "Detailed step-by-step instructions in simple Hinglish",
    "important_links": {
      "apply_online": "Link",
      "download_notification": "Link",
      "official_website": "Link",
      "download_admit_card": "Link",
      "check_result": "Link"
    },
    "faq": [
      { "question": "...", "answer": "..." }
    ]
  }
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