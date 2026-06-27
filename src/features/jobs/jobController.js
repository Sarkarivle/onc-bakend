const Job = require('./jobModel');
const Settings = require('../settings/settingsModel');
const constants = require('../../config/constants');
const jobPrompts = require('./jobPrompts');
const axios = require('axios');
const cheerio = require('cheerio');

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
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end === -1) return cleaned;
        let jsonStr = cleaned.substring(start, end + 1);
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F-\x9F]/g, " ");
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
        let openBraces = (jsonStr.match(/{/g) || []).length;
        let closeBraces = (jsonStr.match(/}/g) || []).length;
        while (openBraces > closeBraces) {
            jsonStr += '}';
            closeBraces++;
        }
        return jsonStr;
    } catch (e) { return text; }
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
    let textToProcess = rawText;

    if (url && !textToProcess) {
        const pageRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
        const $ = cheerio.load(pageRes.data);
        $('script, style, ins, nav, footer, header').remove();
        textToProcess = $('body').text().replace(/\s\s+/g, ' ').trim().substring(0, 4500);
    }

    if (!textToProcess) throw new Error('Input text empty');

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    let runpodUrl = (runpodSetting && runpodSetting.value) || constants.DEFAULT_RUNPOD_URL;

    if (runpodUrl && !runpodUrl.includes('/api/generate')) {
        runpodUrl = runpodUrl.replace(/\/$/, '') + '/api/generate';
    }

    const prompt = jobPrompts.IMPORT_JOB_PROMPT(textToProcess);

    const aiRes = await axios.post(runpodUrl, {
      model: constants.AI_MODEL_NAME,
      prompt: `System: Return ONLY a valid JSON object. No conversation. No preamble.\n\nUser: ${prompt}`,
      stream: false,
      options: {
        temperature: 0.1,
        max_tokens: 3500 // Increased for full HTML content
      }
    });

    const rawAiOutput = aiRes.data.response;
    const cleanedJson = cleanAIResponse(rawAiOutput);

    let result;
    let htmlContent = "";
    try {
        const fullResult = JSON.parse(cleanedJson);
        // Supports dual structure from prompt
        result = fullResult.structured_data || fullResult;
        htmlContent = fullResult.html_content || "";
    } catch (parseErr) {
        console.error('Raw AI Output that failed:', rawAiOutput);
        throw new Error(`AI returned invalid JSON: ${parseErr.message}`);
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

    const newJob = await Job.create({
      title: result.title || 'N/A',
      organization: result.subtitle || 'N/A',
      totalVacancy: toStr(result.job_overview?.total_vacancies),
      salary: toStr(result.job_overview?.salary_approx),
      category: category || 'Latest Jobs',
      applyLink: url || result.important_links?.apply_online || '',
      lastDate: parseDate(result.important_dates?.last_date || result.job_overview?.last_date),
      fullHtmlContent: htmlContent,
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
    });

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

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    let runpodUrl = (runpodSetting && runpodSetting.value) || constants.DEFAULT_RUNPOD_URL;

    if (runpodUrl && !runpodUrl.includes('/api/generate')) {
        runpodUrl = runpodUrl.replace(/\/$/, '') + '/api/generate';
    }

    const advicePrompt = jobPrompts.MATCH_ADVICE_PROMPT(user.name);

    // AI ko sirf zaroori fields bhej rahe hain taaki speed badhe
    // Accurate Primary Date Calculation for AI context
    let primaryDateInfo = { event: "Apply Last Date", daysRemaining: "N/A", status: "future", dateStr: "" };
    try {
        const jobCat = (job.category || "").toLowerCase();

        // Potential events to check in order of importance
        const eventsToCheck = ["last date", "exam date", "admit card", "result", "answer key"];
        if (jobCat.includes('admit')) eventsToCheck.unshift("admit card");
        if (jobCat.includes('result')) eventsToCheck.unshift("result");
        if (jobCat.includes('exam')) eventsToCheck.unshift("exam date");

        let foundEvent = null;
        // Check new structure (label/value) and fallback to old (event/date)
        const allDates = job.fullData?.important_dates || [];
        const overviewLastDate = job.fullData?.job_overview?.last_date;

        for (const eventName of eventsToCheck) {
            let dateStr = (eventName === "last date") ? overviewLastDate : null;
            let actualEventName = (eventName === "last date") ? "Apply Last Date" : eventName;

            const dObj = allDates.find(d => (d.label || d.event || "").toLowerCase().includes(eventName));
            if (dObj) {
                dateStr = dObj.value || dObj.date;
                actualEventName = dObj.label || dObj.event;
            }

            if (dateStr && dateStr !== "Available Soon" && dateStr !== "N/A") {
                let targetDate;
                if (dateStr.includes('-')) {
                    // Try to parse DD-MMM-YYYY
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

    const fullPrompt = `System: Expert Job Advisor. Today is ${new Date().toDateString()}.
    PRIMARY DATE CONTEXT:
    - Event: ${primaryDateInfo.event}
    - Date: ${primaryDateInfo.dateStr}
    - Status: ${primaryDateInfo.status}
    - Days Left: ${primaryDateInfo.daysRemaining}

    IMPORTANT: If status is 'expired', strictly say the date has passed. If 'future', tell exactly how many days/months left. If the event is NOT 'Apply Last Date', mention the event name clearly (e.g., Exam Date, Admit Card).

    Use JOB DATA & USER PROFILE for Hinglish advice.

    JOB DATA:
    ${JSON.stringify(essentialJobData)}

    USER PROFILE:
    Name: ${user.name}, DOB: ${user.dob}, Cat: ${user.category}, Edu: ${user.education || 'N/A'}, City: ${user.city || 'N/A'}

    User: ${advicePrompt}`;

    const aiRes = await axios.post(runpodUrl, {
        model: constants.AI_MODEL_NAME,
        prompt: fullPrompt,
        stream: false,
        options: { temperature: 0.1, top_p: 0.9, max_tokens: 1500 } // Increased for detailed advice
    });

    const cleaned = cleanAIResponse(aiRes.data.response);
    res.status(200).json({ status: 'success', ...JSON.parse(cleaned) });
  } catch (err) {
    console.error('Match Advice Error:', err.message);
    res.status(200).json({ status: 'error', advice: null });
  }
};

const getAllJobs = async (req, res) => {
  const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
};

const updateJob = async (req, res) => {
  const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json({ status: 'success', data: job });
};

const deleteJob = async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: 'success', data: null });
};

module.exports = { getAllJobs, getAiMatchAdvice, importJob, discoverNewJobs, updateJob, deleteJob };
