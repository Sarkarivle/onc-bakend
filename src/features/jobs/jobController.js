const Job = require('./jobModel');
const Settings = require('../settings/settingsModel');
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
    let runpodUrl = (runpodSetting && runpodSetting.value) || "https://d01tlzhc7vd8uq-11434.proxy.runpod.net/api/generate";

    if (runpodUrl && !runpodUrl.includes('/api/generate')) {
        runpodUrl = runpodUrl.replace(/\/$/, '') + '/api/generate';
    }

    const prompt = jobPrompts.IMPORT_JOB_PROMPT(textToProcess);

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return ONLY a valid JSON object. No conversation. No preamble.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    const rawAiOutput = aiRes.data.response;
    const cleanedJson = cleanAIResponse(rawAiOutput);

    let result;
    try {
        result = JSON.parse(cleanedJson);
    } catch (parseErr) {
        console.error('Raw AI Output that failed:', rawAiOutput);
        throw new Error(`AI returned invalid JSON: ${parseErr.message}`);
    }

    const newJob = await Job.create({
      title: result.title || 'N/A',
      organization: result.subtitle || 'N/A',
      totalVacancy: toStr(result.job_overview?.total_vacancies),
      salary: toStr(result.job_overview?.salary_approx),
      category: category || 'Latest Jobs',
      applyLink: url || result.important_links?.apply_online || '',
      importantDates: {
        applicationBegin: toStr(result.job_overview?.application_start),
        applicationLastDate: toStr(result.job_overview?.last_date),
        feePaymentLastDate: toStr(result.important_dates?.find(d => d.event.includes('Fee'))?.date),
        examDate: toStr(result.important_dates?.find(d => d.event.includes('Exam'))?.date || 'As per Schedule')
      },
      applicationFee: {
        generalObcEws: toStr(result.application_fee?.[0]?.fee),
        scStPh: toStr(result.application_fee?.[1]?.fee),
        female: 'N/A'
      },
      eligibility: {
        education: result.eligibility_summary || 'Check Notification',
        minAge: result.age_limit || 'N/A',
        maxAge: 'N/A',
        ageLimit: result.age_limit
      },
      jobSpecifications: result.extra_sections || [],
      aiCoreSummary: { summary: result.about_post },
      fullData: result // Storing the entire JSON for AI Advice context
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

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    let runpodUrl = (runpodSetting && runpodSetting.value) || "https://d01tlzhc7vd8uq-11434.proxy.runpod.net/api/generate";

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
        const allDates = job.fullData?.important_dates || [];
        const overviewLastDate = job.fullData?.job_overview?.last_date;

        // Try to find the FIRST future event or the LAST expired event
        for (const eventName of eventsToCheck) {
            let dateStr = (eventName === "last date") ? overviewLastDate : null;
            let actualEventName = (eventName === "last date") ? "Apply Last Date" : eventName;

            const dObj = allDates.find(d => d.event.toLowerCase().includes(eventName));
            if (dObj) {
                dateStr = dObj.date;
                actualEventName = dObj.event;
            }

            if (dateStr && dateStr !== "Available Soon") {
                let targetDate;
                if (dateStr.includes('-')) targetDate = new Date(dateStr);
                else if (dateStr.includes('/')) {
                    const [d, m, y] = dateStr.split('/');
                    targetDate = new Date(`${y}-${m}-${d}`);
                }

                if (targetDate && !isNaN(targetDate)) {
                    const diffTime = targetDate - new Date();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    const info = {
                        event: actualEventName,
                        daysRemaining: diffDays,
                        status: diffDays < 0 ? "expired" : "future",
                        dateStr: dateStr
                    };

                    // If we find a future event, that's our primary one!
                    if (info.status === "future") {
                        foundEvent = info;
                        break;
                    }
                    // If it's expired, keep it as fallback if we don't find any future ones
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
        eligibility: job.fullData?.eligibility_summary || job.fullData?.vacancy_details,
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
        model: "onc-ai",
        prompt: fullPrompt,
        stream: false,
        options: { temperature: 0.1, top_p: 0.9, max_tokens: 500 } // Faster inference
    });

    const cleaned = cleanAIResponse(aiRes.data.response);
    res.status(200).json({ status: 'success', ...JSON.parse(cleaned) });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
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
