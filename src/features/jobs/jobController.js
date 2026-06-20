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
      USER PROFILE:
      - Naam: ${user.name}
      - Padhai: ${user.education}
      - Category: ${user.category}
      - Umar: ${userAge}
      - State: ${user.domicileState || 'UP'}

      JOB DATA:
      - Title: ${job.title}
      - Required Education: ${job.eligibility?.education || 'Not Specified'}
      - Age Limit: ${job.eligibility?.ageLimit || 'Not Specified'}
      - Last Date: ${job.importantDates?.applicationLastDate || 'Not Specified'}
      - Vacancy: ${job.totalVacancy || 'Not Specified'}
      - Fees: Gen/OBC: ₹${job.applicationFee?.generalObcEws || '0'}, SC/ST/Female: ₹${job.applicationFee?.scStPh || '0'}

      RULES:
      1. User ki details aur Job requirements ko compare karein.
      2. Jawab cut-to-cut Friendly Hinglish me dein. Address him as "${user.name} Bhai".
      3. Return ONLY valid JSON. No extra text.

      JSON structure:
      {
        "advice": "3 lines me personal advice (apnapan tone)",
        "age_status": "Fit" or "Over" or "Limit",
        "age_desc": "Umar match par Hinglish tip",
        "edu_status": "Match" or "No Match",
        "edu_desc": "Education match par Hinglish info",
        "loc_desc": "Location match par info",
        "cat_desc": "Category match par info",
        "comp_desc": "Competition level (Hinglish)",
        "success_desc": "Selection chances (Hinglish)",
        "ai_tip": "Ek short career tip",
        "fee_text": "₹..." (User ki category ke hisab se sahi fees),
        "urgency": "Last date ke hisab se short msg",
        "vacancy_text": "${job.totalVacancy || 'Not Specified'} Posts"
      }
    `;

    const aiResponse = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return valid JSON career advice in Friendly Hinglish.\n\nUser: ${prompt}`,
        stream: false,
        options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);
    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    console.error('AI Error:', err.message);
    res.status(200).json({ success: true, advice: null });
  }
};

const importFromUrl = async (req, res) => {
  try {
    const { url, category } = req.body;
    const pageResponse = await axios.get(url);
    const $ = cheerio.load(pageResponse.data);
    const rawText = $('body').text().replace(/\s\s+/g, ' ').substring(0, 3000);
    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";
    const aiResponse = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Extract job JSON from text.\n\nUser: ${rawText}`,
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
