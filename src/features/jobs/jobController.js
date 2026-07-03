const Job = require('./jobModel');
const Settings = require('../settings/settingsModel');
const constants = require('../../config/constants');
const jobPrompts = require('./jobPrompts');
const axios = require('axios');
const cheerio = require('cheerio');
const VectorService = require('../ai/knowledge/vectorService');
const LLMProvider = require('../ai/generation/core_engine/llmProvider');
const DateTool = require('../ai/tools/dateTool');

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
    let finalHtmlToSave = rawText;

    if (url && !rawText) {
        const pageRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
        finalHtmlToSave = pageRes.data;
        const $ = cheerio.load(pageRes.data);
        $('script, style, ins, nav, footer, header, link, iframe').remove();
        let bodyHtml = $('body').html() || "";
        bodyHtml = bodyHtml.replace(/style="[^"]*"/g, "").replace(/class="[^"]*"/g, "").replace(/id="[^"]*"/g, "").replace(/<!--[\s\S]*?-->/g, "");
        textToProcess = bodyHtml.replace(/\s\s+/g, ' ').trim().substring(0, 15000);
    }

    if (!textToProcess) throw new Error('Input text empty');

    const prompt = jobPrompts.IMPORT_JOB_PROMPT(textToProcess);
    const result = await LLMProvider.generateLogic(prompt);
    if (!result) throw new Error('AI Engine failed to generate structured data');

    const parseDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string' || dateStr === 'N/A' || dateStr.toLowerCase().includes('soon')) return null;
        try {
            let d;
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const months = { 'jan':0, 'feb':1, 'mar':2, 'apr':3, 'may':4, 'jun':5, 'jul':6, 'aug':7, 'sep':8, 'oct':9, 'nov':10, 'dec':11 };
                    const m = months[parts[1].toLowerCase().substring(0,3)];
                    if (m !== undefined) d = new Date(parseInt(parts[2]), m, parseInt(parts[0]));
                }
            }
            if (!d || isNaN(d.getTime())) d = new Date(dateStr);
            return (d && !isNaN(d.getTime())) ? d : null;
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

    try {
        const textToEmbed = VectorService.createJobText(jobObject);
        const vector = await VectorService.generate(textToEmbed);
        if (vector) jobObject.searchVector = vector;
    } catch (vErr) { console.error("Vector Error:", vErr.message); }

    const newJob = await Job.create(jobObject);
    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const getAiMatchAdvice = async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = req.user;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ status: 'error', message: 'Job not found' });

    // 1. Calculate Core Facts (Non-AI Logic)
    const userAge = calculateAge(user.dob);
    const jobElig = job.fullData?.eligibility || {};
    const minAge = parseInt(jobElig.min_age) || 0;
    const maxAge = parseInt(jobElig.max_age) || 99;

    let ageStatus = "Fit";
    if (userAge < minAge) ageStatus = "Under";
    else if (userAge > maxAge) ageStatus = "Over";
    else if (userAge >= maxAge - 2) ageStatus = "Limit";

    const userCat = (user.category || 'General').toUpperCase();
    const isReserved = userCat.includes('SC') || userCat.includes('ST') || userCat.includes('PH');
    const jobFees = job.fullData?.application_fee || {};
    const calculatedFee = isReserved ? (jobFees.sc_st_ph || '0') : (jobFees.gen_obc_ews || 'N/A');

    let primaryDateStr = job.fullData?.job_overview?.last_date || job.fullData?.important_dates?.last_date || "N/A";
    const urgencyResult = DateTool.calculateUrgency(primaryDateStr);

    const vacancyCount = job.totalVacancy || 'Not Specified';

    // 2. Pure UI Response (No AI analysis)
    const response = {
        match_score: (urgencyResult.status === 'expired' || ageStatus === 'Over') ? 0 : 80,
        advice: `Namaste ${user.name.split(' ')[0]}! Yeh job aapke liye achhi ho sakti hai.`,
        urgency: urgencyResult.text || "Check Notification",
        fee_text: calculatedFee.includes('₹') ? calculatedFee : `₹${calculatedFee}`,
        age_desc: `${userAge} Years (${ageStatus})`,
        age_status: ageStatus,
        vacancy_text: (vacancyCount === 'N/A' || vacancyCount.toLowerCase().includes('not applicable')) ? "Not Applicable" : (vacancyCount.includes('Post') ? vacancyCount : `${vacancyCount} Posts`),
        edu_desc: `${user.education || 'N/A'} (Details check karein)`,
        edu_status: "Match",
        loc_desc: "Location details notification me dekhein.",
        cat_desc: "Apni category ke hisab se vacancy check karein.",
        comp_desc: "Competition level normal hai.",
        success_desc: "Good match detected.",
        ai_tip: "Last date se pehle apply karein!"
    };

    res.status(200).json({ status: 'success', ...response });
  } catch (err) {
    res.status(200).json({ status: 'error', advice: null });
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
  } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
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
