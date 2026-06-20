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

const cleanAIResponse = (text) => {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) return text.substring(start, end + 1);
        return text;
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

    // MASTER PROMPT: UI-Focused Mapping
    const prompt = `
      You are SarkariVLE's Data Extractor. Convert TEXT to JSON.
      RULES:
      1. Use exact keys: "title", "organization", "importantDates" (applicationBegin, applicationLastDate, feePaymentDeadline, examDate), "applicationFee" (generalObcEws, scStPh, female), "eligibility" (minAge, maxAge, totalVacancy, salary, education).
      2. Rewrite values in student Hinglish.
      3. Create extra sections for FAQ, Selection, etc. in a "sections" array.
      TEXT: ${textToProcess}
    `;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON only.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    const result = JSON.parse(cleanAIResponse(aiRes.data.response));

    const newJob = await Job.create({
      title: result.title,
      organization: result.organization,
      category: category || 'Jobs',
      applyLink: url || '',
      importantDates: result.importantDates,
      applicationFee: result.applicationFee,
      eligibility: result.eligibility,
      jobSpecifications: result.sections || [],
      aiCoreSummary: { ...result.eligibility, lastDate: result.importantDates?.applicationLastDate }
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

    const prompt = `
      Compare User ${user.name} (Edu: ${user.education}, Age: ${userAge}, Cat: ${user.category})
      with Job ${job.title} (Req: ${JSON.stringify(job.aiCoreSummary)}).
      Return Friendly Hinglish JSON match advice.
    `;

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return JSON advice only.\n\nUser: ${prompt}`,
        stream: false
    });

    res.status(200).json({ status: 'success', ...JSON.parse(cleanAIResponse(aiRes.data.response)) });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const deleteJob = async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: 'success', data: null });
};

module.exports = { getAllJobs, getAiMatchAdvice, importJob, deleteJob };
