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
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      results: jobs.length,
      data: jobs
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const importFromUrl = async (req, res) => {
  try {
    const { url, category } = req.body;
    if (!url) throw new Error('URL is required');

    const pageResponse = await axios.get(url);
    const $ = cheerio.load(pageResponse.data);
    const rawText = $('body').text().replace(/\s\s+/g, ' ').substring(0, 5000);

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const prompt = `
      You are SarkariVLE’s Automated Job Data Extractor.
      Extract details from RAW TEXT and return JSON ONLY.
      RAW TEXT: ${rawText}
    `;

    const aiResponse = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON only.\n\nUser: ${prompt}`,
      stream: false,
      options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);

    const jobData = {
        ...result.jobData,
        fullHtmlContent: result.htmlTemplate,
        applyLink: url,
        category: category || result.jobData?.category || 'Jobs'
    };

    const newJob = await Job.create(jobData);
    res.status(201).json({ status: 'success', data: newJob });

  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const addJobFromJson = async (req, res) => {
  try {
    const { jobJson, category } = req.body;
    const parsedData = typeof jobJson === 'string' ? JSON.parse(jobJson) : jobJson;

    const jobData = {
      ...parsedData,
      totalVacancy: parsedData.totalVacancy || parsedData.vacancy || 'N/A',
      salary: parsedData.salary || 'Not Disclosed',
      category: category || parsedData.category || 'General',
    };

    const newJob = await Job.create(jobData);
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

    const aiResponse = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `Analyze job for ${user.name}...`,
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

const deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(404).json({ status: 'fail', message: 'Job not found' });
  }
};

module.exports = {
  getAllJobs,
  importFromUrl,
  addJobFromJson,
  getAiMatchAdvice,
  deleteJob
};
