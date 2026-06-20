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

// 1. ADMIN DISCOVERY
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

    res.status(200).json({ status: 'success', links: newLinks });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// 2. ADMIN IMPORT (AI)
const importFromUrl = async (req, res) => {
  try {
    const { url, category } = req.body;
    if (!url) throw new Error('URL is required');

    const pageResponse = await axios.get(url);
    const $ = cheerio.load(pageResponse.data);
    const rawText = $('body').text().replace(/\s\s+/g, ' ').substring(0, 6000);

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const prompt = `Extract job details from raw text and return detailed ELASTIC JSON. RAW TEXT: ${rawText}`;

    const aiResponse = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON only.\n\nUser: ${prompt}`,
      stream: false,
      options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
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
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// 3. ADMIN UPDATE (Edit functionality)
const updateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) throw new Error('Job not found');
    res.status(200).json({ status: 'success', data: job });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', data: jobs });
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

    const aiResponse = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `Analyze match for ${user.name} against ${job.title}. Return friendly Hinglish JSON.`,
        stream: false,
        options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    res.status(200).json({ status: 'success', ...JSON.parse(resultText) });
  } catch (err) {
    res.status(200).json({ success: true, advice: null });
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

module.exports = { getAllJobs, getAiMatchAdvice, importFromUrl, discoverNewJobs, updateJob, deleteJob };
