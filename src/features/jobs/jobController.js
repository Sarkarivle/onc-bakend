const Job = require('./jobModel');
const Settings = require('../settings/settingsModel');
const constants = require('../../config/constants');
const jobPrompts = require('./jobPrompts');
const axios = require('axios');
const cheerio = require('cheerio');
const EligibilityEngine = require('../eligibility/EligibilityEngine');
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
      title: result.structured_data?.title || result.title || 'N/A',
      organization: result.structured_data?.subtitle || result.subtitle || 'N/A',
      totalVacancy: toStr(result.structured_data?.job_overview?.total_vacancies || result.job_overview?.total_vacancies),
      salary: toStr(result.structured_data?.job_overview?.salary_approx || result.job_overview?.salary_approx),
      category: category || 'Latest Jobs',
      description: result.structured_data?.about_post || result.about_post || '',
      applyLink: url || result.structured_data?.important_links?.apply_online || result.important_links?.apply_online || '',
      lastDate: parseDate(result.structured_data?.important_dates?.last_date || result.important_dates?.last_date || result.job_overview?.last_date),
      fullHtmlContent: finalHtmlToSave,
      importantDates: {
        applicationBegin: toStr(result.structured_data?.important_dates?.begin || result.important_dates?.begin || result.job_overview?.application_start),
        applicationLastDate: toStr(result.structured_data?.important_dates?.last_date || result.important_dates?.last_date || result.job_overview?.last_date),
        feePaymentLastDate: toStr(result.structured_data?.important_dates?.fee_last_date || result.important_dates?.fee_last_date),
        examDate: toStr(result.structured_data?.important_dates?.exam_date || result.important_dates?.exam_date)
      },
      applicationFee: {
        generalObcEws: toStr(result.structured_data?.application_fee?.gen_obc_ews || result.application_fee?.gen_obc_ews),
        scStPh: toStr(result.structured_data?.application_fee?.sc_st_ph || result.application_fee?.sc_st_ph),
        female: toStr(result.structured_data?.application_fee?.female || result.application_fee?.female)
      },
      eligibility: {
        education: toStr(result.structured_data?.eligibility?.education || result.eligibility?.education),
        minAge: toStr(result.structured_data?.eligibility?.min_age || result.eligibility?.min_age),
        maxAge: toStr(result.structured_data?.eligibility?.max_age || result.eligibility?.max_age),
        ageLimit: toStr(result.structured_data?.eligibility?.age_limit_as_on || result.eligibility?.age_limit_as_on)
      },
      // Store the high-precision rule map for the Eligibility Engine
      base_constraints: result.rule_map || result.base_constraints || null,

      jobSpecifications: result.job_specifications || [],
      aiCoreSummary: { summary: result.structured_data?.about_post || result.about_post },
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
    // CRITICAL FIX: Re-fetch full user profile from DB to ensure no data is missing
    const User = require('../auth/userModel');
    const user = await User.findById(req.user.id).lean();

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ status: 'error', message: 'Job not found' });

    // 1. Run the New High-Precision Eligibility Engine
    const report = await EligibilityEngine.evaluate(user, job);

    // Failsafe for engine errors
    if (report.status === 'ERROR') {
        throw new Error(report.message);
    }

    // 2. ULTIMATE DATE SEARCH (Retained for frontend urgency display)
    let lastDateStr = "N/A";
    if (job.lastDate && !isNaN(new Date(job.lastDate).getTime())) {
        lastDateStr = job.lastDate.toISOString();
    } else {
        const checkFields = [
            job.importantDates?.applicationLastDate,
            job.fullData?.job_overview?.last_date,
            job.fullData?.important_dates?.last_date
        ];
        lastDateStr = checkFields.find(f => f && f !== 'N/A' && f !== '') || "N/A";
    }

    const urgencyResult = DateTool.calculateUrgency(lastDateStr);

    // 3. Response Construction (Mapping New Engine Report to Legacy UI fields for compatibility)
    const ageInfo = report.age_analysis?.exact_age || {};
    let ageStatus = 'Fit';
    let ageDesc = "Update Profile";

    if (report.status === 'INCOMPLETE_PROFILE' && !user.dob) {
        ageStatus = 'Need Data';
        ageDesc = "N/A (Update Profile)";
    } else {
        const ageFail = report.failed_rules.find(r => r.module === 'AGE');
        if (ageFail) {
            ageStatus = (ageInfo.years < (report.age_analysis.base_min_age || 18)) ? 'Under' : 'Over';
        }
        ageDesc = `${ageInfo.years || '??'} Years (${ageStatus})`;
    }

    const eduStatus = report.failed_rules.some(r => r.module === 'EDUCATION') ? 'No Match' : 'Match';
    let eduDesc = user.education || "N/A";
    if (!user.education) {
        eduDesc = "Update Profile";
    } else {
        eduDesc = `${user.education} (${eduStatus})`;
    }

    const isReserved = (user.category || '').match(/SC|ST|PH/i);
    let feeText = isReserved ? (job.applicationFee?.scStPh || '0') : (job.applicationFee?.generalObcEws || 'N/A');

    res.status(200).json({
        status: 'success',
        match_score: report.match_score,
        advice: report.ai_tip,
        urgency: urgencyResult.text,
        fee_text: feeText.includes('₹') ? feeText : `₹${feeText}`,
        age_desc: ageDesc,
        age_status: ageStatus,
        vacancy_text: job.totalVacancy || 'Not Specified',
        edu_desc: eduDesc,
        edu_status: eduStatus,

        // Detailed report for new UI features
        full_report: report,
        missing_fields: report.missing_fields || [],
        extra_notes: report.extra_notes || [],

        // Legacy fields for stability
        loc_desc: "Location aapke profile ke hisab se sahi hai.",
        cat_desc: "Aapki category me vacancies available hain.",
        comp_desc: "Isme selection ke chances acche hain.",
        success_desc: report.status === 'ELIGIBLE' ? "Strong match detected." : "Requirements mismatch."
    });
  } catch (err) {
    console.error("Match Advice Error:", err);
    res.status(200).json({ status: 'error', advice: null });
  }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ status: 'error', message: 'Job not found' });
    res.status(200).json({ status: 'success', data: job });
  } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

const updateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ status: 'success', data: job });
  } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

const createJob = async (req, res) => {
  try {
    const job = await Job.create(req.body);
    res.status(201).json({ status: 'success', data: job });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

const deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

module.exports = { getAllJobs, getJob, getAiMatchAdvice, importJob, discoverNewJobs, updateJob, deleteJob, createJob };
