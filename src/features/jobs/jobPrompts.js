module.exports = {
    IMPORT_JOB_PROMPT: (textToProcess) => `Extract job info to JSON.
Rules:
1. JSON ONLY. No preamble.
2. Branding: Use "JOBO".
3. Hinglish: Summaries/instructions in simple Hinglish.
4. Zero-loss: Include all dates, fees, vacancies, eligibility, age.
5. Create "rule_map" for eligibility.

Schema:
{
  "structured_data": {
    "title": "", "subtitle": "", "about_post": "Hinglish summary",
    "job_overview": { "department": "", "post_name": "", "total_vacancies": "", "application_start": "", "last_date": "", "salary_approx": "" },
    "important_dates": { "begin": "", "last_date": "", "fee_last_date": "", "exam_date": "" },
    "application_fee": { "gen_obc_ews": "", "sc_st_ph": "", "female": "" },
    "eligibility": { "education": "", "min_age": "", "max_age": "", "age_limit_as_on": "" },
    "vacancy_details": { "total": "", "general": "", "obc": "", "ews": "", "sc": "", "st": "" },
    "how_to_apply": "Hinglish steps",
    "important_links": { "apply_online": "", "download_notification": "", "official_website": "" }
  },
  "rule_map": {
    "education": { "level": "10TH|12TH|ITI/DIPLOMA|GRADUATE|PG", "required_degrees": [] },
    "physical": { "male": { "GENERAL": { "height": 165 }, "ANY": { "height": 160 } }, "female": { "ANY": { "height": 155 } } },
    "extra_requirements": ["Hinglish notes"]
  }
}

Data:
${textToProcess}`
};
