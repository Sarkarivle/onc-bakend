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
        if (start !== -1 && end !== -1) {
            return text.substring(start, end + 1);
        }
        return text;
    } catch (e) { return text; }
};

// 1. DISCOVERY: SarkariResult links
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

// 2. MASTER IMPORT: This stores data for BOTH UI and Advice
const importJob = async (req, res) => {
  try {
    const { url, rawText, category } = req.body;
    let textToProcess = rawText;

    if (url && !textToProcess) {
        const pageRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(pageRes.data);
        textToProcess = $('body').text().replace(/\s\s+/g, ' ').substring(0, 6000);
    }

    if (!textToProcess) throw new Error('Input text empty');

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    // MASTER PROMPT: Fixed structure for advice and UI
    const prompt = `
      You are SarkariVLE Extractor. Convert TEXT to JSON.
      JSON Schema: {
        "title": "Job Name",
        "organization": "Board",
        "core": { "education": "...", "ageLimit": "...", "vacancy": "...", "lastDate": "..." },
        "sections": [ { "heading": "Title", "type": "table/text", "data": {...} } ]
      }
      TEXT: ${textToProcess}
    `;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON ONLY. No chat.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    const cleanedJson = cleanAIResponse(aiRes.data.response);
    const result = JSON.parse(cleanedJson);

    // Save everything in 'specifications' for UI and 'coreRequirements' for Advice
    const newJob = await Job.create({
      title: result.title || 'Untitled',
      organization: result.organization || 'Sarkari VLE',
      category: category || 'Latest Jobs',
      applyLink: url || '',
      specifications: { sections: result.sections || [] },
      coreRequirements: result.core || {}
    });

    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: `Processing error: ${err.message}` });
  }
};

// 3. PERSONALIZED ADVICE: Using the stored data
const getAiMatchAdvice = async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = req.user;
    const job = await Job.findById(jobId);
    if (!job) throw new Error('Job not found');

    const userAge = calculateAge(user.dob);
    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    // AI ko ab stored core requirements mil rahi hain
    const prompt = `
      User: ${user.name}, Edu: ${user.education}, Age: ${userAge}, Cat: ${user.category}.
      Job: ${job.title}. Core Requirements: ${JSON.stringify(job.coreRequirements)}.
      Analyze match and return Hinglish JSON (advice, age_status, edu_status, ai_tip, fee_text).
    `;

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return Friendly Hinglish Advice JSON.\n\nUser: ${prompt}`,
        stream: false
    });

    const cleanedJson = cleanAIResponse(aiRes.data.response);
    res.status(200).json({ status: 'success', ...JSON.parse(cleanedJson) });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
};

const getAllJobs = async (req, res) => {
  const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', data: jobs });
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
