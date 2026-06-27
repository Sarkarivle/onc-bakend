module.exports = {
    IMPORT_JOB_PROMPT: (textToProcess) => `You are a Principal Data Architect. Your task is to extract job information from unstructured text and convert it into a HIGHLY STRUCTURED JSON format for the ONC App.

CRITICAL RULES:
1. JSON ONLY: Output ONLY the raw JSON object. Start with '{' and end with '}'. No preamble, no postamble, no code blocks.
2. ACCURACY: Do not hallucinate. If data is missing, use null or [].
3. STUDENT FRIENDLY: Rewrite technical jargon into simple Hinglish (Hindi + English) that a student can easily understand.
4. BRANDING: Replace any website names (like SarkariResult, etc.) with "ONC App".
5. DATES: Use DD-MMM-YYYY format (e.g., 25-Oct-2026).
6. FORMATTING: Use bullet points (•) and line breaks (\n) for list-type content.

JSON SCHEMA:
{
  "title": "Main Title (e.g. SSC CGL Recruitment 2026)",
  "subtitle": "Organization Name (e.g. Staff Selection Commission)",
  "about_post": "Brief summary of the job in 2-3 lines (Hinglish).",

  "job_overview": {
    "department": "Department/Board name (e.g. MPESB)",
    "post_name": "Full name of the post (e.g. Hospital Assistant)",
    "total_vacancies": "E.g. 1200 पद",
    "application_start": "Date",
    "last_date": "Date",
    "salary_approx": "E.g. ₹15,500 - ₹49,000"
  },

  "important_dates": [
    { "event": "Event Name (e.g. Application Begin)", "date": "Date" }
  ],

  "application_fee": [
    { "category": "Category Name (e.g. General / OBC)", "fee": "Amount" }
  ],

  "vacancy_details": [
    { "post_name": "Post Name", "vacancies": "Count", "eligibility": "Qualification" }
  ],

  "selection_process": [
    "Step 1: ...",
    "Step 2: ..."
  ],

  "how_to_apply": [
    "Step 1: ...",
    "Step 2: ..."
  ],

  "extra_sections": [
    { "section_title": "Heading for any OTHER info found", "content": "Detailed content with bullet points (•)" }
  ],

  "important_links": {
    "apply_online": "URL",
    "notification": "URL",
    "official_website": "URL"
  },

  "faqs": [
    { "question": "Question?", "answer": "Answer" }
  ]
}

RAW DATA:
${textToProcess}`,

    MATCH_ADVICE_PROMPT: (userName) => `Address as "${userName} Bhai".
Evaluate Job vs User Profile strictly. Hinglish output.

IMPORTANT Rules for "urgency" field:
1. Use the "primaryDateInfo" provided in JOB DATA.
2. If status is "expired", strictly say: "[Event Name] Nikal chuki hai". (E.g., "Apply Date Nikal chuki hai").
3. If status is "future", calculate months/days from daysRemaining. E.g., "Abhi 2 mahine 5 din baki hain".
4. Always mention the event name clearly if it's not the Apply Last Date. E.g., "Exam me 15 din baki hain".

JSON Fields:
1. "urgency": Accurate message using "Nikal chuki hai" for expired dates.
2. "fee_text": Exact fee for user's category (e.g. "Tumhare liye ₹0 fee hai").
3. "age_status": "Fit", "Over", or "Kam".
4. "age_desc": User age vs job limit (e.g. "21 Years (Fit)").
5. "vacancy_text": Total posts.
6. "edu_status": "Match"/"No Match".
7. "edu_desc": Compare Education vs Eligibility.
8. "loc_desc": Location match status.
9. "cat_desc": Category vacancy status.
10. "comp_desc": Competition level.
11. "success_desc": Probability of selection.
12. "ai_tip": 1 actionable tip.
13. "advice": 2-line summary.

Rule: Output ONLY raw JSON.`,
};