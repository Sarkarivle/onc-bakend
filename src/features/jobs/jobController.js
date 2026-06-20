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

    if (!textToProcess) throw new Error('No input data');

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    // MASTER PROMPT: 18 Steps to JSON
    const prompt = `
      You are SarkariVLE’s Automated Job Data Extractor.
      Convert RAW TEXT into a detailed JSON object following these 18 steps:
      1. Title, 2. Subtitle, 3. About, 4. Overview, 5. Dates, 6. Fee, 7. Age, 8. Relaxation, 9. Vacancy, 10. Eligibility, 11. Physical, 12. Who can apply, 13. Selection, 14. How to Apply, 15. Notes, 16. Extra, 17. Links, 18. FAQ.

      RULES:
      - Rewrite in simple Hinglish.
      - Replace website names with "Sarkari VLE".
      - JSON must have keys: "title", "organization", "importantDates", "applicationFee", "eligibility", "sections" (array of {title, content}).
    `;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return valid JSON ONLY. NO CHAT.\n\nUser: ${prompt}\n\nTEXT: ${textToProcess}`,
      stream: false, options: { temperature: 0.1 }
    });

    const result = JSON.parse(cleanAIResponse(aiRes.data.response));

    const newJob = await Job.create({
      title: result.title || 'Untitled',
      organization: result.organization || 'Sarkari VLE',
      category: category || 'Latest Jobs',
      applyLink: url || '',

      // Map AI data to fixed App UI fields
      importantDates: result.importantDates || {},
      applicationFee: result.applicationFee || {},
      eligibility: result.eligibility || {},

      // Map AI data to ELASTIC Sections for App to show dynamic content
      jobSpecifications: result.sections || [],

      // Store core requirements for AI Match Advice
      aiCoreSummary: {
        education: result.eligibility?.education,
        age: result.eligibility?.ageLimit,
        fee: result.applicationFee,
        vacancy: result.eligibility?.totalVacancy
      }
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
      User ${user.name} (Edu: ${user.education}, Age: ${userAge}, Cat: ${user.category})
      Job Requirements: ${JSON.stringify(job.aiCoreSummary)}.
      Return Personalized Hinglish Advice JSON (advice, age_status, edu_status, ai_tip, fee_text, urgency).
      Address him as "${user.name} Bhai".
    `;

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return valid JSON advice.\n\nUser: ${prompt}`,
        stream: false
    });

    res.status(200).json({ status: 'success', ...JSON.parse(cleanAIResponse(aiRes.data.response)) });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
  } catch (err) { res.status(400).json({ status: 'fail', message: err.message }); }
};

const deleteJob = async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: 'success', data: null });
};

module.exports = { getAllJobs, getAiMatchAdvice, importJob, deleteJob };
