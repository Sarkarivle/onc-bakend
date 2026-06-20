const Job = require('./jobModel');
const Settings = require('../settings/settingsModel');
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

// Helper: Ensure everything is a String to prevent Flutter crashes
const toStr = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
};

const cleanAIResponse = (text) => {
    try {
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1) return cleaned.substring(start, end + 1);
        return cleaned;
    } catch (e) { return text; }
};

const importJob = async (req, res) => {
  try {
    const { url, rawText, category } = req.body;
    let textToProcess = rawText;

    if (url && !textToProcess) {
        const pageRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(pageRes.data);
        textToProcess = $('body').text().replace(/\s\s+/g, ' ').substring(0, 7000);
    }

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const prompt = `Extract job details to JSON. Rules: All values MUST be Strings. No arrays. Use keys exactly. TEXT: ${textToProcess}`;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON only. Every value must be a String.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    const result = JSON.parse(cleanAIResponse(aiRes.data.response));

    const newJob = await Job.create({
      title: toStr(result.title),
      organization: toStr(result.organization),
      totalVacancy: toStr(result.totalVacancy || result.vacancy),
      salary: toStr(result.salary),
      category: category || 'Latest Jobs',
      applyLink: url || '',
      importantDates: {
        applicationBegin: toStr(result.importantDates?.applicationBegin),
        applicationLastDate: toStr(result.importantDates?.applicationLastDate),
        feePaymentLastDate: toStr(result.importantDates?.feePaymentLastDate),
        examDate: toStr(result.importantDates?.examDate || 'As per Schedule')
      },
      applicationFee: {
        generalObcEws: toStr(result.applicationFee?.generalObcEws),
        scStPh: toStr(result.applicationFee?.scStPh),
        female: toStr(result.applicationFee?.female)
      },
      eligibility: {
        education: toStr(result.eligibility?.education),
        minAge: toStr(result.eligibility?.minAge),
        maxAge: toStr(result.eligibility?.maxAge),
        ageLimit: toStr(result.eligibility?.ageLimit)
      },
      jobSpecifications: result.sections || [],
      aiCoreSummary: result.core || {}
    });

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
    const userAge = calculateAge(user.dob);
    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `Compare ${user.name} with ${job.title}. Return Hinglish JSON. Ensure advice, urgency, ai_tip are single strings.`,
        stream: false
    });

    const adviceResult = JSON.parse(cleanAIResponse(aiRes.data.response));

    // Safety for advice response
    const finalAdvice = {};
    Object.keys(adviceResult).forEach(key => {
        finalAdvice[key] = toStr(adviceResult[key]);
    });

    res.status(200).json({ status: 'success', ...finalAdvice });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
};

const getAllJobs = async (req, res) => {
  const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
};

const deleteJob = async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: 'success', data: null });
};

module.exports = { getAllJobs, getAiMatchAdvice, importJob, deleteJob };
