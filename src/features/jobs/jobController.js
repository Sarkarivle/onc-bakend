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

// 1. DISCOVERY: Naye Links dhoondhna
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
    const existing = await Job.find({}, 'applyLink');
    const existingLinks = existing.map(j => j.applyLink);
    const newLinks = discovered.filter(item => !existingLinks.includes(item.url));
    res.status(200).json({ status: 'success', links: newLinks });
  } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

// 2. IMPORT: Professional 18-step AI Scraping
const importFromUrl = async (req, res) => {
  try {
    const { url, category } = req.body;
    if (!url) throw new Error('URL missing');

    const pageRes = await axios.get(url);
    const $ = cheerio.load(pageRes.data);
    const rawText = $('body').text().replace(/\s\s+/g, ' ').substring(0, 6000);

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const prompt = `
      You are SarkariVLE’s Automated Job Data Extractor.
      Extract ALL details from RAW DATA and return an ELASTIC JSON object.
      Replace website names with "Sarkari VLE".
      Create sections following the 18-step structure: Overview, Dates, Fee, Age, Eligibility, Physical, FAQ, etc.

      JSON STRUCTURE:
      {
        "title": "Full Job Name",
        "organization": "Board Name",
        "core": { "education": "...", "ageLimit": "...", "vacancy": "...", "lastDate": "DD/MM/YYYY" },
        "sections": [
           { "heading": "Important Dates", "type": "table", "data": { "Start": "...", "Last Date": "..." } },
           { "heading": "Application Fee", "type": "table", "data": { "General": "...", "SC/ST": "..." } },
           { "heading": "Eligibility", "type": "text", "content": "..." },
           { "heading": "FAQ", "type": "list", "items": ["Q:...", "A:..."] }
        ]
      }
      RAW TEXT: ${rawText}
    `;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return detailed JSON only.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    let resultText = aiRes.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);

    const newJob = await Job.create({
      title: result.title || 'Untitled',
      organization: result.organization || 'Sarkari VLE',
      category: category || 'Latest Jobs',
      applyLink: url,
      specifications: { sections: result.sections },
      coreRequirements: result.core || {}
    });

    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) { res.status(400).json({ status: 'fail', message: err.message }); }
};

// 3. ADVICE: Personalized Match Advice using Elastic Data
const getAiMatchAdvice = async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = req.user;
    const job = await Job.findById(jobId);
    const userAge = calculateAge(user.dob);
    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const prompt = `
      User: ${user.name}, Edu: ${user.education}, Age: ${userAge}, Cat: ${user.category}.
      Job: ${job.title}. Full Specs: ${JSON.stringify(job.specifications)}.
      Analyze match and return Personalized Hinglish JSON (advice, status, desc, fee_text, urgency).
      Address him as "${user.name} Bhai".
    `;

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return Friendly Hinglish JSON advice only.\n\nUser: ${prompt}`,
        stream: false, options: { temperature: 0.1 }
    });

    let resultText = aiRes.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    res.status(200).json({ status: 'success', ...JSON.parse(resultText) });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', data: jobs });
  } catch (err) { res.status(400).json({ status: 'fail', message: err.message }); }
};

const updateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ status: 'success', data: job });
  } catch (err) { res.status(400).json({ status: 'fail', message: err.message }); }
};

const deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) { res.status(404).json({ status: 'fail', message: 'Job not found' }); }
};

module.exports = { getAllJobs, getAiMatchAdvice, importFromUrl, discoverNewJobs, updateJob, deleteJob };
