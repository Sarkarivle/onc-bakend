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

const toStr = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const cleanAIResponse = (text) => {
    try {
        // 1. Remove markdown backticks
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // 2. Find the first '{' and last '}'
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');

        if (start === -1 || end === -1) return cleaned;

        let jsonStr = cleaned.substring(start, end + 1);

        // 3. Fix common AI JSON errors (like unescaped quotes in middle of text)
        // This is a basic sanitizer
        return jsonStr;
    } catch (e) { return text; }
};

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

const importJob = async (req, res) => {
  try {
    const { url, rawText, category } = req.body;
    let textToProcess = rawText;

    if (url && !textToProcess) {
        const pageRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
        const $ = cheerio.load(pageRes.data);
        textToProcess = $('body').text().replace(/\s\s+/g, ' ').substring(0, 4500); // Reduced length for stability
    }

    if (!textToProcess) throw new Error('Input text empty');

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const prompt = `Convert TEXT to JSON. RULES: Use single quotes for any emphasis inside text. NO double quotes inside strings.
    Keys: title, organization, importantDates (applicationBegin, applicationLastDate, feePaymentLastDate, examDate),
    applicationFee (generalObcEws, scStPh, female), eligibility (education, minAge, maxAge, ageLimit), totalVacancy, salary, sections (array of {title, content}).
    TEXT: ${textToProcess}`;

    const aiRes = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return ONLY a valid JSON object. No conversation. No preamble.\n\nUser: ${prompt}`,
      stream: false, options: { temperature: 0.1 }
    });

    const rawAiOutput = aiRes.data.response;
    const cleanedJson = cleanAIResponse(rawAiOutput);

    let result;
    try {
        result = JSON.parse(cleanedJson);
    } catch (parseErr) {
        console.error('Raw AI Output that failed:', rawAiOutput);
        throw new Error(`AI returned invalid JSON: ${parseErr.message}`);
    }

    const newJob = await Job.create({
      title: toStr(result.title),
      organization: toStr(result.organization),
      totalVacancy: toStr(result.totalVacancy || result.vacancy),
      salary: toStr(result.salary),
      category: category || 'Latest Jobs',
      applyLink: url || '',
      importantDates: {
        applicationBegin: toStr(result.importantDates?.applicationBegin),
        applicationLastDate: toStr(result.importantDates?.applicationLastDate),
        feePaymentLastDate: toStr(result.importantDates?.feePaymentLastDate),
        examDate: toStr(result.importantDates?.examDate || 'As per Schedule')
      },
      applicationFee: {
        generalObcEws: toStr(result.applicationFee?.generalObcEws),
        scStPh: toStr(result.applicationFee?.scStPh),
        female: toStr(result.applicationFee?.female)
      },
      eligibility: {
        education: toStr(result.eligibility?.education),
        minAge: toStr(result.eligibility?.minAge),
        maxAge: toStr(result.eligibility?.maxAge),
        ageLimit: toStr(result.eligibility?.ageLimit)
      },
      jobSpecifications: Array.isArray(result.sections) ? result.sections : [],
      aiCoreSummary: result.core || {}
    });

    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) {
    console.error('Import Error:', err.message);
    res.status(400).json({ status: 'fail', message: `Data Error: ${err.message}` });
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

    const prompt = `Address him as "${user.name} Bhai". Return Hinglish match advice JSON only.`;

    const aiRes = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: Return JSON only.\n\nUser: ${prompt}`,
        stream: false
    });

    const cleaned = cleanAIResponse(aiRes.data.response);
    res.status(200).json({ status: 'success', ...JSON.parse(cleaned) });
  } catch (err) { res.status(200).json({ success: true, advice: null }); }
};

const getAllJobs = async (req, res) => {
  const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: jobs.length, data: jobs });
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
