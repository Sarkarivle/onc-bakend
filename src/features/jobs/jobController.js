const Job = require('./jobModel');
const Settings = require('../settings/settingsModel');
const constants = require('../../config/constants');
const jobPrompts = require('./jobPrompts');
const matchPrompts = require('./matchPrompts');
const axios = require('axios');
const cheerio = require('cheerio');
const VectorService = require('../ai/knowledge/vectorService');
const GenerationProvider = require('../ai/generation/generationProvider');

const calculateAge = (dob) => {
  if (!dob) return 24;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const toStr = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const cleanAIResponse = (text) => {
    try {
        if (!text) return "{}";
        // Remove markdown code blocks if present
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Find the first { and last }
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');

        if (start !== -1 && end !== -1) {
            cleaned = cleaned.substring(start, end + 1);
        }

        // 1. Fix missing commas between properties on new lines
        // This must be done BEFORE removing newlines
        cleaned = cleaned.replace(/([\"0-9\]\}])\s*\n\s*\"/g, '$1, "');

        // 2. Remove control characters (but handle common ones safely)
        cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, " ");

        // 3. Fix missing commas that might have been lost or were horizontal: "key": "val" "key2"
        // This heuristic is safer: a quote followed by space and another quote, only if NOT part of a colon.
        // For simplicity, we'll use a more targeted one in the fallback parse if needed.

        // 4. Fix trailing commas
        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

        return cleaned;
    } catch (e) {
        console.error('Cleaning Error:', e);
        return text;
    }
};

const discoverNewJobs = async (req, res) => {
  try {
    const response = await axios.get('https://www.sarkariresult.com/latestjob/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    const discovered = [];
    $('#post_field a').each((i, el) => {
      const url = $(el).attr('href');
      const title = $(el).text().trim();
      if (url && url.includes('sarkariresult.com')) discovered.push({ title, url });
    });
    res.status(200).json({ status: 'success', links: discovered });
  } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

const importJob = async (req, res) => {
  try {
    const { url, rawText, category } = req.body;
    let textToProcess = rawText; // AI ke liye
    let finalHtmlToSave = rawText; // Database ke liye

    if (url && !rawText) {
        const pageRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });

        // Database ke liye bilkul RAW HTML/Text (bina kisi cleaning ke)
        finalHtmlToSave = pageRes.data;

        // AI ke liye hum HTML clean karenge taaki tokens bachein aur response sahi aaye
        const $ = cheerio.load(pageRes.data);
        $('script, style, ins, nav, footer, header, link, iframe').remove();
        let bodyHtml = $('body').html() || "";
        bodyHtml = bodyHtml.replace(/style="[^"]*"/g, "")
                          .replace(/class="[^"]*"/g, "")
                          .replace(/id="[^"]*"/g, "")
                          .replace(/<!--[\s\S]*?-->/g, "");

        textToProcess = bodyHtml.replace(/\s\s+/g, ' ').trim().substring(0, 15000);
    }

    if (!textToProcess) throw new Error('Input text empty');

    const prompt = jobPrompts.IMPORT_JOB_PROMPT(textToProcess);

    const aiRes = await GenerationProvider.generate(prompt, {
        stream: false,
        options: { temperature: 0.1, max_tokens: 20000 }
    });


    const rawAiOutput = aiRes.response;
    const cleanedJson = cleanAIResponse(rawAiOutput);

    let result;
    try {
        const fullResult = JSON.parse(cleanedJson);
        result = fullResult.structured_data || fullResult;
    } catch (parseErr) {
        try {
            // Aggressive fallback cleaning for unescaped quotes
            // Look for quotes NOT preceded by structural chars and NOT followed by structural chars
            const aggressive = cleanedJson.replace(/(?<![:\{\[,\s])"(?![\s]*[:,\}\]])/g, '\\"');
            const fullResult = JSON.parse(aggressive);
            result = fullResult.structured_data || fullResult;
        } catch (secondaryErr) {
            console.error('Raw AI Output that failed:', rawAiOutput);
            throw new Error(`AI returned invalid JSON: ${parseErr.message}`);
        }
    }

    const parseDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string' || dateStr === 'N/A' || dateStr.toLowerCase().includes('soon')) return null;
        try {
            let d;
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const months = { 'jan':0, 'feb':1, 'mar':2, 'apr':3, 'may':4, 'jun':5, 'jul':6, 'aug':7, 'sep':8, 'oct':9, 'nov':10, 'dec':11 };
                    const monthKey = parts[1].toLowerCase().substring(0,3);
                    const m = months[monthKey];
                    if (m !== undefined) {
                        d = new Date(parseInt(parts[2]), m, parseInt(parts[0]));
                    }
                }
            }
            if (!d || isNaN(d.getTime())) d = new Date(dateStr);
            if (!d || isNaN(d.getTime())) return null;
            return d;
        } catch (e) { return null; }
    };

    const jobObject = {
      title: result.title || 'N/A',
      organization: result.subtitle || 'N/A',
      totalVacancy: toStr(result.job_overview?.total_vacancies),
      salary: toStr(result.job_overview?.salary_approx),
      category: category || 'Latest Jobs',
      description: result.about_post || '',
      applyLink: url || result.important_links?.apply_online || '',
      lastDate: parseDate(result.important_dates?.last_date || result.job_overview?.last_date),
      fullHtmlContent: finalHtmlToSave,
      importantDates: {
        applicationBegin: toStr(result.important_dates?.begin || result.job_overview?.application_start),
        applicationLastDate: toStr(result.important_dates?.last_date || result.job_overview?.last_date),
        feePaymentLastDate: toStr(result.important_dates?.fee_last_date),
        examDate: toStr(result.important_dates?.exam_date)
      },
      applicationFee: {
        generalObcEws: toStr(result.application_fee?.gen_obc_ews),
        scStPh: toStr(result.application_fee?.sc_st_ph),
        female: toStr(result.application_fee?.female)
      },
      eligibility: {
        education: toStr(result.eligibility?.education),
        minAge: toStr(result.eligibility?.min_age),
        maxAge: toStr(result.eligibility?.max_age),
        ageLimit: toStr(result.eligibility?.age_limit_as_on)
      },
      jobSpecifications: result.job_specifications || [],
      aiCoreSummary: { summary: result.about_post },
      fullData: result
    };

    // --- PHASE: Semantic Search Integration ---
    try {
        const textToEmbed = VectorService.createJobText(jobObject);
        const vector = await VectorService.generate(textToEmbed);
        if (vector) jobObject.searchVector = vector;
    } catch (vErr) {
        console.error("⚠️ Failed to generate job vector:", vErr.message);
    }

    const newJob = await Job.create(jobObject);

    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) {
    console.error('Import Error:', err.message);
    res.status(400).json({ status: 'fail', message: `Data Error: ${err.message}` });
  }
};

const getAiMatchAdvice = async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = req.user;
    const job = await Job.findById(jobId);

    if (!job) {
        return res.status(404).json({ status: 'error', message: 'Job not found' });
    }

    const advicePrompt = matchPrompts.MATCH_ADVICE_PROMPT(user.name);

    let primaryDateInfo = { event: "Apply Last Date", daysRemaining: "N/A", status: "future", dateStr: "" };
    try {
        const jobCat = (job.category || "").toLowerCase();
        const eventsToCheck = ["last date", "exam date", "admit card", "result", "answer key"];
        if (jobCat.includes('admit')) eventsToCheck.unshift("admit card");
        if (jobCat.includes('result')) eventsToCheck.unshift("result");
        if (jobCat.includes('exam')) eventsToCheck.unshift("exam date");

        let foundEvent = null;
        const allDatesData = job.fullData?.important_dates || {};
        const overviewLastDate = job.fullData?.job_overview?.last_date;

        for (const eventName of eventsToCheck) {
            let dateStr = (eventName === "last date") ? overviewLastDate : null;
            let actualEventName = (eventName === "last date") ? "Apply Last Date" : eventName;

            // Handle both Array and Object formats
            if (Array.isArray(allDatesData)) {
                const dObj = allDatesData.find(d => (d.label || d.event || "").toLowerCase().includes(eventName));
                if (dObj) {
                    dateStr = dObj.value || dObj.date;
                    actualEventName = dObj.label || dObj.event;
                }
            } else if (typeof allDatesData === 'object') {
                // If it's an object, look for keys that match eventName
                const key = Object.keys(allDatesData).find(k => k.toLowerCase().replace(/_/g, ' ').includes(eventName));
                if (key) {
                    dateStr = allDatesData[key];
                    actualEventName = key.replace(/_/g, ' ').toUpperCase();
                }
            }

            if (dateStr && dateStr !== "Available Soon" && dateStr !== "N/A") {
                let targetDate;
                if (dateStr.includes('-')) {
                    const parts = dateStr.split('-');
                    if (parts.length === 3 && isNaN(parts[1])) {
                        const months = { 'jan':0, 'feb':1, 'mar':2, 'apr':3, 'may':4, 'jun':5, 'jul':6, 'aug':7, 'sep':8, 'oct':9, 'nov':10, 'dec':11 };
                        const m = months[parts[1].toLowerCase().substring(0,3)];
                        targetDate = new Date(parseInt(parts[2]), m, parseInt(parts[0]));
                    } else {
                        targetDate = new Date(dateStr);
                    }
                }
                else if (dateStr.includes('/')) {
                    const [d, m, y] = dateStr.split('/');
                    targetDate = new Date(`${y}-${m}-${d}`);
                }

                if (targetDate && !isNaN(targetDate.getTime())) {
                    const diffTime = targetDate - new Date();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    const info = {
                        event: actualEventName,
                        daysRemaining: diffDays,
                        status: diffDays < 0 ? "expired" : "future",
                        dateStr: dateStr
                    };

                    if (info.status === "future") {
                        foundEvent = info;
                        break;
                    }
                    if (!foundEvent || (foundEvent.status === "expired" && eventName === "last date")) {
                        foundEvent = info;
                    }
                }
            }
        }
        if (foundEvent) primaryDateInfo = foundEvent;
    } catch (e) { console.error("Date calc error", e); }

    const essentialJobData = {
        title: job.title,
        category: job.category,
        overview: job.fullData?.job_overview,
        dates: job.fullData?.important_dates,
        fees: job.fullData?.application_fee,
        eligibility: job.fullData?.eligibility || job.fullData?.vacancy_details || job.fullData?.eligibility_summary,
        vacancy: job.totalVacancy,
        primaryDateInfo: primaryDateInfo
    };

    // --- STEP: Pre-calculate Facts for Accuracy ---
    const userAge = calculateAge(user.dob);
    const jobElig = job.fullData?.eligibility || {};
    const minAge = parseInt(jobElig.min_age) || 0;
    const maxAge = parseInt(jobElig.max_age) || 99;

    let ageStatus = "Fit";
    if (userAge < minAge) ageStatus = "Under";
    else if (userAge > maxAge) ageStatus = "Over";
    else if (userAge >= maxAge - 2) ageStatus = "Limit";

    // Fee Calculation
    const userCat = (user.category || 'General').toUpperCase();
    const isReserved = userCat.includes('SC') || userCat.includes('ST') || userCat.includes('PH');
    const jobFees = job.fullData?.application_fee || {};
    const calculatedFee = isReserved ? (jobFees.sc_st_ph || '0') : (jobFees.gen_obc_ews || 'N/A');

    // Urgency Text
    let urgencyText = "Jaldi Karein";
    if (primaryDateInfo.status === 'expired') urgencyText = "Date nikal chuki h";
    else if (primaryDateInfo.daysRemaining === 0) urgencyText = "Aaj aakhri din hai";
    else if (primaryDateInfo.daysRemaining === 1) urgencyText = "1 din rah gaya hai";
    else if (primaryDateInfo.daysRemaining > 0) urgencyText = `${primaryDateInfo.daysRemaining} din baki hai`;

    // Vacancy and Education simple check
    const vacancyCount = job.totalVacancy || 'Not Specified';
    const requiredEdu = (jobElig.education || 'Check Notification').toString();

    const calculatedFacts = {
        age_desc: `${userAge} Years (${ageStatus})`,
        age_status: ageStatus,
        fee_text: calculatedFee.includes('₹') ? calculatedFee : `₹${calculatedFee}`,
        urgency: urgencyText,
        vacancy_text: vacancyCount.includes('Post') ? vacancyCount : `${vacancyCount} Posts`,
        user_qualification: user.education || 'N/A',
        job_qualification: requiredEdu,
        is_expired: primaryDateInfo.status === 'expired'
    };

    const fullPrompt = `System: You are a Job Data Processor. Today is ${new Date().toDateString()}.

    TOOL_RESULTS (TRUST THESE OVER EVERYTHING ELSE):
    - URGENCY: ${calculatedFacts.urgency}
    - FEE: ${calculatedFacts.fee_text}
    - AGE_DESC: ${calculatedFacts.age_desc}
    - AGE_STATUS: ${calculatedFacts.age_status}
    - VACANCY: ${calculatedFacts.vacancy_text}
    - USER_EDU: ${calculatedFacts.user_qualification}
    - JOB_EDU: ${calculatedFacts.job_qualification}

    INSTRUCTIONS:
    1. Use the EXACT values from TOOL_RESULTS for the corresponding JSON keys.
    2. Compare USER_EDU and JOB_EDU to set "edu_status" (Match/No Match) and "edu_desc".
    3. Calculate "match_score" (0-100). If is_expired is true, score must be 0.
    4. Generate "advice" in short Hinglish addressing the user as "${user.name.split(' ')[0]} Bhai".

    JOB CONTEXT:
    ${JSON.stringify(essentialJobData)}

    User: ${advicePrompt}`;

    const aiRes = await GenerationProvider.generate(fullPrompt, {
        stream: false,
        options: { temperature: 0.1, top_p: 0.9, max_tokens: 1500 }
    });


    const rawOutput = aiRes.response;
    let cleaned = cleanAIResponse(rawOutput);

    try {
        const parsed = JSON.parse(cleaned);
        res.status(200).json({ status: 'success', ...parsed });
    } catch (parseErr) {
        try {
            // Secondary attempt with aggressive quote fixing
            const fixed = cleaned.replace(/(?<![:\{\[,\s])"(?![\s]*[:,\}\]])/g, '\\"');
            const parsed = JSON.parse(fixed);
            res.status(200).json({ status: 'success', ...parsed });
        } catch (e) {
            console.error('Failed to parse AI advice:', cleaned);
            res.status(500).json({ status: 'error', message: 'AI response parsing failed' });
        }
    }
  } catch (err) {
    console.error('Match Advice Error:', err.message);
    res.status(500).json({ status: 'error', message: 'Could not generate match advice' });
  }
};

const getAllJobs = async (req, res) => {
  const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
};

const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ status: 'error', message: 'Job not found' });
    res.status(200).json({ status: 'success', data: job });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

const updateJob = async (req, res) => {
  const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json({ status: 'success', data: job });
};

const deleteJob = async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: 'success', data: null });
};

module.exports = { getAllJobs, getJob, getAiMatchAdvice, importJob, discoverNewJobs, updateJob, deleteJob };
