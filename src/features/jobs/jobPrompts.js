module.exports = {
    IMPORT_JOB_PROMPT: (textToProcess) => `You are a Principal Data Architect and Template Generator. Your task is to extract job info into a structured JSON format.

CRITICAL RULES:
1. Output ONLY a valid JSON object. No preamble, no postamble.
2. BRANDING: Replace any website names with "Sarkari VLE".
3. REWRITING: Use simple, student-friendly Hinglish for summaries only.
4. ZERO-LOSS EXTRACTION: Extract everything. Do not skip Important Dates, Application Fees, Vacancy, Eligibility, Age Limit, or How to Apply.
5. RULE MAPPING: You MUST also create a "rule_map" field for the Eligibility Engine.

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
    "vacancy_details": { "total": "...", "general": "...", "obc": "...", "ews": "...", "sc": "...", "st": "..." },
    "how_to_apply": "Detailed step-by-step instructions in simple Hinglish",
    "important_links": { "apply_online": "Link", "download_notification": "Link", "official_website": "Link" }
  },
  "rule_map": {
    "education": {
       "level": "Identify one: 10TH PASS | 12TH PASS | ITI/DIPLOMA | GRADUATE | POST GRADUATE | PHD",
       "required_degrees": ["B.ED", "BTC", "D.EL.ED", "ITI", "DIPLOMA", "CCC"] // Add all that apply
    },
    "physical": {
       "male": {
          "GENERAL": { "height": 165, "chest": 81 },
          "SC_ST": { "height": 160, "chest": 79 },
          "ANY": { "height": 165 }
       },
       "female": {
          "ANY": { "height": 155 }
       }
    },
    "skills": ["HINDI TYPING", "ENGLISH TYPING", "STENO", "CCC"]
  }
}

RAW DATA:
${textToProcess}`
};
