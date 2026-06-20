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

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
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
      Aap ONC App ke expert career assistant hain. User ${user.name} ke liye is job ko analyze karein.
      User Profile: Edu: ${user.education}, Category: ${user.category}, Age: ${userAge}.
      Job Details: ${job.title}, Vacancy: ${job.totalVacancy || 'Not Specified'}.
      Fees Info: General/OBC: ₹${job.applicationFee?.generalObcEws || '0'}, SC/ST/Female: ₹${job.applicationFee?.scStPh || '0'}.

      Strictly return valid JSON in Friendly Hinglish (Bhai/Dost tone).
      Jawab cut-to-cut aur personalized hona chahiye. Address him as "${user.name} Bhai" or "${user.name} Dost".

      JSON structure:
      {
        "advice": "2-3 lines of personal advice (apnapan tone)",
        "age_status": "Fit" or "Over" or "Limit",
        "age_desc": "Choti personal tip age par",
        "edu_status": "Match" or "No Match",
        "edu_desc": "Padhai match info",
        "loc_desc": "Location info",
        "cat_desc": "Category info",
        "success_desc": "Selection chances",
        "ai_tip": "Ek choti personal tip",
        "fee_text": "₹..." (Category ke hisab se sahi fees),
        "urgency": "Short urgency text (e.g. Aaj aakhri din hai!)",
        "vacancy_text": "${job.totalVacancy || 'Not Specified'}"
      }
    `;

    const aiResponse = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return valid JSON only in Friendly Hinglish.\n\nUser: ${prompt}`,
        stream: false,
        options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);
    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    console.error('AI Match Error:', err.message);
    res.status(200).json({ success: true, advice: null });
  }
};

const importFromUrl = async (req, res) => {
  try {
    const { url, category } = req.body;
    if (!url) throw new Error('URL is required');
    const pageResponse = await axios.get(url);
    const $ = cheerio.load(pageResponse.data);
    const rawText = $('body').text().replace(/\s\s+/g, ' ').substring(0, 3000);
    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const aiResponse = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Extract job JSON details.\n\nUser: ${rawText}`,
      stream: false,
      options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);
    const newJob = await Job.create({ ...result.jobData, fullHtmlContent: result.htmlTemplate, applyLink: url, category: category || 'Jobs' });
    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const addJobFromJson = async (req, res) => {
  try {
    const { jobJson, category } = req.body;
    const parsedData = typeof jobJson === 'string' ? JSON.parse(jobJson) : jobJson;
    const newJob = await Job.create({ ...parsedData, category: category || 'General' });
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

module.exports = { getAllJobs, getAiMatchAdvice, importFromUrl, addJobFromJson, deleteJob };
