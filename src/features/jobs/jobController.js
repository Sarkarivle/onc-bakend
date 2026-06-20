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

    // MASTER PROMPT: Implementing your 18 Rules and Elastic Structure
    const prompt = `
      You are SarkariVLE’s Automated Job Template Generator.
      EXTRACT data from RAW TEXT and return JSON only.
      RULES:
      1. Rewrite in simple student-friendly Hinglish.
      2. Replace any website name with "Sarkari VLE".
      3. Create these sections in order: Title, Board Name, About Post, Job Overview, Important Dates, Fee, Age, Vacancy, Eligibility, Physical, Selection, How to Apply, FAQ.

      JSON SCHEMA: {
        "title": "...", "organization": "...",
        "sections": [ { "heading": "Section Name", "type": "table/text", "data": {...} } ],
        "core": { "education": "...", "ageLimit": "...", "fees": "..." }
      }
      TEXT: ${textToProcess}
    `;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON only. No chat.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    const result = JSON.parse(cleanAIResponse(aiRes.data.response));

    const newJob = await Job.create({
      title: result.title,
      organization: result.organization,
      category: category || 'Jobs',
      applyLink: url || '',
      jobSpecifications: result.sections.map(s => ({
          heading: s.heading,
          sectionType: s.type,
          sectionData: s.data || s.content || s.items
      })),
      aiCoreSummary: result.core
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

    // AI ab database me save huye pure specification ka use karega
    const prompt = `
      User: ${user.name}, Edu: ${user.education}, Age: ${userAge}, Cat: ${user.category}.
      Job Info: ${JSON.stringify(job.aiCoreSummary)}.
      Analyze match and return Hinglish JSON (advice, age_status, edu_status, ai_tip, fee_text).
    `;

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return Friendly Hinglish Advice JSON.\n\nUser: ${prompt}`,
        stream: false
    });

    res.status(200).json({ status: 'success', ...JSON.parse(cleanAIResponse(aiRes.data.response)) });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
};

const getAllJobs = async (req, res) => {
  const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', data: jobs });
};

const deleteJob = async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: 'success', data: null });
};

module.exports = { getAllJobs, getAiMatchAdvice, importJob, deleteJob };
