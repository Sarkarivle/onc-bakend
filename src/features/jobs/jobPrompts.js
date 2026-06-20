module.exports = {
    IMPORT_JOB_PROMPT: (textToProcess) => `You are SarkariVLE’s Automated Job JSON Generator.

IMPORTANT GLOBAL RULES:
---------------------------------------
- Output ONLY ONE complete, valid JSON object.
- DO NOT use markdown formatting, code fences (like \`\`\`json), or any conversational text. Return ONLY the raw JSON object.
- NEVER copy any sentence exactly from RAW DATA.
→ Always rewrite in simple, clean, student-friendly language.
- Wherever any website name is found in RAW DATA → ALWAYS replace it with "Sarkari VLE".
- Do NOT include any HTML tags or CSS anywhere in the output.
- If a section is missing in the RAW DATA → return null or an empty array [] for that key.
- If there is extra info → add it to the "extra_sections" array.

---------------------------------------
SPECIAL RULES:
---------------------------------------
1) DATE FORMATTING:
Whenever there is a "Last Date" or "Application Last Date", format it clearly (e.g., "25-Aug-2026").

2) ARRAYS & OBJECTS:
Use arrays for lists (like FAQs, Selection Process) and objects for key-value pairs (like Job Overview, Important Links).

---------------------------------------
REQUIRED JSON STRUCTURE (EXACT KEYS):
---------------------------------------
{
  "title": "...rewritten title...",
  "subtitle": "...rewritten board / exam name...",
  "about_post": "...rewritten summary...",
  "job_overview": {
    "department": "...auto detect...",
    "post_name": "...auto detect...",
    "total_vacancies": "...auto detect...",
    "application_start": "...if available or null...",
    "last_date": "...auto detect...",
    "salary_approx": "...if available or null..."
  },
  "important_dates": [
    {
      "event": "Application Begin",
      "date": "..."
    },
    {
      "event": "Last Date for Apply Online",
      "date": "..."
    }
  ],
  "application_fee": [
    {
      "category": "General / OBC",
      "fee": "..."
    },
    {
      "category": "SC / ST",
      "fee": "..."
    }
  ],
  "age_limit": "...rewritten text about age limit...",
  "age_relaxation": {
    "OBC": "As per rules",
    "SC": "As per rules",
    "ST": "As per rules",
    "Other_Categories": "As per rules"
  },
  "vacancy_details": [
    {
      "post_name": "...",
      "vacancies": "...",
      "eligibility": "..."
    }
  ],
  "eligibility_summary": "...rewritten overall eligibility...",
  "physical_standard": [
    {
      "category": "Male",
      "details": "..."
    }
  ],
  "who_can_apply": "...All India / State candidates / Male / Female (auto detect)...",
  "selection_process": [
    "Written Examination",
    "Physical Test (if applicable)",
    "Document Verification",
    "Medical Examination"
  ],
  "how_to_apply": [
    "Visit the official website.",
    "Complete the registration process.",
    "Fill the application form carefully.",
    "Upload all required documents.",
    "Pay the fee and submit the form."
  ],
  "important_notes": [
    "Incorrect information may lead to rejection.",
    "Preview the form before final submission.",
    "Apply only through the official website."
  ],
  "extra_sections": [
    {
      "section_title": "...",
      "content": "..."
    }
  ],
  "important_links": {
    "apply_online": "Link or 'Available Soon'",
    "notification": "Link or 'Click Here'",
    "short_notice": "Link or 'Click Here'",
    "official_website": "Link or 'Click Here'",
    "sarkarivle_app": "https://play.google.com/store/apps/details?id=com.blogpro.sarkarivle&hl=en_IN",
    "whatsapp_channel": "Link or 'Click Here'"
  },
  "faq": [
    {
      "question": "Q1. ...?",
      "answer": "Ans. ..."
    },
    {
      "question": "Q2. ...?",
      "answer": "Ans. ..."
    },
    {
      "question": "Q3. ...?",
      "answer": "Ans. ..."
    },
    {
      "question": "Q4. ...?",
      "answer": "Ans. ..."
    }
  ]
}

---------------------------------------
RAW DATA: ${textToProcess}`,

    MATCH_ADVICE_PROMPT: (userName) => `Address him as "${userName} Bhai".
    Context: You are looking at the job details provided in the system.
    Task: Analyze the job's eligibility, dates, and vacancy.
    Return Hinglish match advice JSON only.`
};
