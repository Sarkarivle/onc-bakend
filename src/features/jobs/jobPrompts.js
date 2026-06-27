module.exports = {
    IMPORT_JOB_PROMPT: (textToProcess) => `You are a Principal Data Architect and Job Template Generator. Your task is to extract job information and provide a dual-format response: A structured JSON for the database and a complete HTML block for the UI.

CRITICAL PIPELINE RULES:
1. Output ONLY a valid JSON object. No preamble, no postamble.
2. JSON MUST contain two main keys: "structured_data" (Object) and "html_content" (String).
3. BRANDING: Replace any website names with "Sarkari VLE".
4. REWRITING: Always rewrite sentences in simple, student-friendly Hinglish.

[HTML CONTENT RULES]:
- Generate ONE complete HTML block using classes: sv-box, sv-h1, sv-h2, sv-about, sv-table.
- Apply special colors: Last Date value in RED (<span style="color: #ff0000;">), Important Links heading in PINK (<h2 class="sv-h2" style="color: #ff66cc;">).
- Follow the EXACT structural order provided in the template (Title -> About -> Overview -> Dates -> Fees -> Age -> Vacancy -> Eligibility -> Physical -> Who can apply -> Process -> How to apply -> Notes -> Links -> FAQ).

JSON SCHEMA:
{
  "structured_data": {
    "title": "Cleaned up title",
    "subtitle": "Board name",
    "about_post": "2 line summary",
    "job_overview": {
      "department": "...", "post_name": "...", "total_vacancies": "...", "application_start": "...", "last_date": "...", "salary_approx": "..."
    },
    "important_dates": [ { "label": "...", "value": "..." } ],
    "application_fee": [ { "category": "...", "fee": "..." } ]
  },
  "html_content": "PASTE THE COMPLETE SARKARI VLE HTML BLOCK HERE AS A SINGLE ESCAPED STRING"
}

RAW DATA TO PROCESS:
${textToProcess}`,

    MATCH_ADVICE_PROMPT: (userName) => `Address as "${userName} Bhai". Output ONLY raw JSON.`
};