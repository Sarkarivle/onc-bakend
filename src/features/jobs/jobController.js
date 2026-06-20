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

// Helper to extract JSON from AI's conversational response
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

// 1. DISCOVERY
const discoverNewJobs = async (req, res) => {
  try {
    const targetUrl = 'https://www.sarkariresult.com/latestjob/';
    const response = await axios.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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

// 2. MASTER IMPORT
const importJob = async (req, res) => {
  try {
    const { url, rawText, category } = req.body;
    let textToProcess = rawText;

    if (url && !textToProcess) {
        const pageRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
        const $ = cheerio.load(pageRes.data);
        textToProcess = $('body').text().replace(/\s\s+/g, ' ').substring(0, 6000);
    }

    if (!textToProcess) throw new Error('No data found to process');

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const prompt = `Convert Job Text to JSON. Use fields: title, organization, core (education, ageLimit, vacancy, lastDate), and sections array. NO CONVERSATION. JSON ONLY. TEXT: ${textToProcess}`;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: You are a data parser. Return ONLY a valid JSON object. Do not say "Bhai" or anything else.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    // Cleaning response to find only the {...} block
    const cleanedJson = cleanAIResponse(aiRes.data.response);
    const result = JSON.parse(cleanedJson);

    const newJob = await Job.create({
      title: result.title || 'Untitled',
      organization: result.organization || 'Sarkari VLE',
      category: category || 'Latest Jobs',
      applyLink: url || '',
      specifications: { sections: result.sections },
      coreRequirements: result.core || {}
    });

    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) {
    console.error('Import Error:', err.message);
    res.status(400).json({ status: 'fail', message: `AI Error: ${err.message}` });
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

    const prompt = `Address him as "${user.name} Bhai". Use Friendly Hinglish. Compare User (Edu: ${user.education}, Age: ${userAge}) with Job ${job.title}. Return JSON with fields: advice, age_status, edu_status, ai_tip, fee_text.`;

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return Friendly Hinglish JSON match advice only.\n\nUser: ${prompt}`,
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
