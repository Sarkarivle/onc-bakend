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

// 1. ADMIN DISCOVERY: Latest links nikalna
const discoverNewJobs = async (req, res) => {
  try {
    const targetUrl = 'https://www.sarkariresult.com/latestjob/';
    const response = await axios.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);

    const discoveredLinks = [];
    $('#post_field a').each((i, el) => {
      const url = $(el).attr('href');
      const title = $(el).text().trim();
      if (url && url.includes('sarkariresult.com')) {
        discoveredLinks.push({ title, url });
      }
    });

    const existingJobs = await Job.find({}, 'applyLink');
    const existingLinks = existingJobs.map(j => j.applyLink);
    const newLinks = discoveredLinks.filter(item => !existingLinks.includes(item.url));

    res.status(200).json({
      status: 'success',
      totalFound: discoveredLinks.length,
      newLinksCount: newLinks.length,
      links: newLinks
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// 2. ADMIN IMPORT: URL se AI Scraper chalana (Elastic JSON)
const importFromUrl = async (req, res) => {
  try {
    const { url, category } = req.body;
    if (!url) throw new Error('URL is required');

    const pageResponse = await axios.get(url);
    const $ = cheerio.load(pageResponse.data);
    const rawText = $('body').text().replace(/\s\s+/g, ' ').substring(0, 6000);

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    // MASTER PROMPT: Extracting data as dynamic sections
    const prompt = `
      You are SarkariVLE’s Automated Job Data Extractor.
      Convert RAW TEXT into a detailed "Elastic JSON" object.
      Replace any website name with "Sarkari VLE".
      Create sections for: Important Dates, Fee, Age, Eligibility, Physical, FAQ, etc.
      RAW TEXT: ${rawText}
    `;

    const aiResponse = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return detailed JSON only.\n\nUser: ${prompt}`,
      stream: false,
      options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);

    const newJob = await Job.create({
      title: result.title || 'Untitled Job',
      organization: result.organization || 'Sarkari VLE',
      category: category || 'Latest Jobs',
      applyLink: url,
      specifications: { sections: result.sections },
      coreRequirements: result.core || {}
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
    if (!job) throw new Error('Job not found');

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";
    const userAge = calculateAge(user.dob);

    const prompt = `
      Analyze match for ${user.name} (Edu: ${user.education}, Age: ${userAge})
      against Job ${job.title} using this Data: ${JSON.stringify(job.specifications)}.
      Address him as "${user.name} Bhai". Use friendly Hinglish. Return JSON.
    `;

    const aiResponse = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return Friendly Hinglish JSON advice.\n\nUser: ${prompt}`,
        stream: false,
        options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);
    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    res.status(200).json({ success: true, advice: null });
  }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const addJobFromJson = async (req, res) => {
  try {
    const parsedData = typeof req.body.jobJson === 'string' ? JSON.parse(req.body.jobJson) : req.body.jobJson;
    const newJob = await Job.create({ ...parsedData, category: req.body.category || 'General' });
    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(404).json({ status: 'fail', message: 'Job not found' });
  }
};

module.exports = { getAllJobs, getAiMatchAdvice, importFromUrl, discoverNewJobs, addJobFromJson, deleteJob };
