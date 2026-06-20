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

// 1. DISCOVERY: Latest links
const discoverNewJobs = async (req, res) => {
  try {
    const targetUrl = 'https://www.sarkariresult.com/latestjob/';
    const response = await axios.get(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
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

// 2. MASTER IMPORT: (Handles both URL Scraping and Direct Text Paste)
const importJob = async (req, res) => {
  try {
    const { url, rawText, category } = req.body;
    let textToProcess = rawText;

    // Agar URL diya hai aur text nahi, toh scrape karne ki koshish karo
    if (url && !textToProcess) {
        try {
            const pageRes = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 5000
            });
            const $ = cheerio.load(pageRes.data);
            textToProcess = $('body').text().replace(/\s\s+/g, ' ').substring(0, 6000);
        } catch (e) {
            return res.status(400).json({ status: 'fail', message: 'Scraping blocked. Please copy-paste the text manually.' });
        }
    }

    if (!textToProcess) return res.status(400).json({ status: 'fail', message: 'No data to process' });

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const prompt = `Convert this Job Text into ELASTIC JSON. Include Title, Organization, Core (Education, Age, Vacancy, lastDate), and ALL details as Sections. TEXT: ${textToProcess}`;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON only.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    let resultText = aiRes.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);

    const newJob = await Job.create({
      title: result.title || 'Untitled',
      organization: result.organization || 'Sarkari VLE',
      category: category || 'Latest Jobs',
      applyLink: url || '',
      specifications: { sections: result.sections },
      coreRequirements: result.core || {}
    });

    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) { res.status(400).json({ status: 'fail', message: err.message }); }
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
        prompt: `System: Return Friendly Hinglish JSON match advice.\n\nUser: Compare ${user.name} with ${job.title}`,
        stream: false
    });

    let resultText = aiRes.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    res.status(200).json({ status: 'success', ...JSON.parse(resultText) });
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
