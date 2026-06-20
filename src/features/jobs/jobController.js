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
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1) return cleaned.substring(start, end + 1);
        return cleaned;
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

    const prompt = `
      You are SarkariVLE's AI Parser. Extract text to JSON.
      Keys MUST be: title, organization, totalVacancy, salary,
      importantDates (applicationBegin, applicationLastDate, feePaymentLastDate, examDate),
      applicationFee (generalObcEws, scStPh, female),
      eligibility (education, minAge, maxAge, ageLimit),
      sections (array of {title, content}).
    `;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON only.\n\nUser: ${prompt}\n\nTEXT: ${textToProcess}`,
      stream: false, options: { temperature: 0.1 }
    });

    const result = JSON.parse(cleanAIResponse(aiRes.data.response));

    // Backend side mapping to fix Total Vacancy and other fields for existing App model
    const vacancy = result.totalVacancy || result.vacancy || result.total_post || 'N/A';
    const salary = result.salary || 'Not Disclosed';

    const newJob = await Job.create({
      title: result.title || 'Untitled',
      organization: result.organization || 'Sarkari VLE',
      totalVacancy: vacancy,
      salary: salary,
      category: category || 'Latest Jobs',
      applyLink: url || '',
      importantDates: {
        applicationBegin: result.importantDates?.applicationBegin || 'N/A',
        applicationLastDate: result.importantDates?.applicationLastDate || 'N/A',
        feePaymentLastDate: result.importantDates?.feePaymentLastDate || 'N/A',
        examDate: result.importantDates?.examDate || 'As per Schedule'
      },
      applicationFee: result.applicationFee || {},
      eligibility: result.eligibility || {},
      jobSpecifications: result.sections || [],
      aiCoreSummary: {
        education: result.eligibility?.education,
        age: result.eligibility?.ageLimit,
        vacancy: vacancy
      }
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

    const prompt = `Analyze match for ${user.name} (Edu: ${user.education}, Age: ${userAge}, Cat: ${user.category}) with Job ${job.title}. Return Hinglish JSON.`;

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return JSON advice.\n\nUser: ${prompt}`,
        stream: false
    });

    res.status(200).json({ status: 'success', ...JSON.parse(cleanAIResponse(aiRes.data.response)) });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
};

const getAllJobs = async (req, res) => {
  const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
};

const deleteJob = async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: 'success', data: null });
};

module.exports = { getAllJobs, getAiMatchAdvice, importJob, deleteJob };
