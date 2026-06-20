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

const importFromUrl = async (req, res) => {
  try {
    const { url, category } = req.body;
    if (!url) throw new Error('URL is required');

    // 1. Scraping Raw Data
    const pageResponse = await axios.get(url);
    const $ = cheerio.load(pageResponse.data);
    const rawText = $('body').text().replace(/\s\s+/g, ' ').substring(0, 6000);

    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    // 2. AI Prompt (Elastic JSON Extraction)
    const prompt = `
      You are SarkariVLE’s Automated Job Data Extractor.
      Extract ALL details from RAW TEXT and return a valid "Elastic JSON" object.

      RULES:
      - NEVER miss any information. If a section exists in RAW DATA, it MUST be in JSON.
      - Use clear headings for sections.
      - Replace website names with "Sarkari VLE".

      OUTPUT JSON STRUCTURE:
      {
        "title": "Full Job Name",
        "organization": "Board Name",
        "core": {
          "education": "Required qualification summary",
          "ageLimit": "Min-Max age",
          "vacancy": "Total posts",
          "lastDate": "DD/MM/YYYY"
        },
        "sections": [
          { "heading": "Important Dates", "type": "table", "data": { "Start": "...", "Last Date": "..." } },
          { "heading": "Application Fee", "type": "table", "data": { "Gen/OBC": "...", "SC/ST": "..." } },
          { "heading": "Eligibility", "type": "text", "content": "Detailed education requirements..." },
          { "heading": "Physical Standard", "type": "table", "data": { "Height": "...", "Chest": "..." } },
          { "heading": "FAQ", "type": "list", "items": ["Q1:...", "A1:..."] }
        ]
      }

      RAW TEXT: ${rawText}
    `;

    const aiResponse = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: Return JSON only. Be detailed and elastic.\n\nUser: ${prompt}`,
      stream: false,
      options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);

    // 3. Saving to Database
    const finalData = {
      title: result.title,
      organization: result.organization,
      category: category || 'Jobs',
      applyLink: url,
      specifications: { sections: result.sections }, // Full elastic data
      coreRequirements: result.core
    };

    if (result.core.lastDate) {
      const parts = result.core.lastDate.split('/');
      if (parts.length === 3) finalData.lastDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }

    const newJob = await Job.create(finalData);
    res.status(201).json({ status: 'success', data: newJob });

  } catch (err) {
    console.error('Import Error:', err.message);
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

    // AI ab database me save kiye gaye Elastic Specifications ka use karega
    const prompt = `
      User ${user.name} (Edu: ${user.education}, Cat: ${user.category}, Age: ${userAge})
      Job Details: ${JSON.stringify(job.coreRequirements)}
      Full Specs: ${JSON.stringify(job.specifications)}

      Analyze and give Personalized advice in Friendly Hinglish JSON.
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
    res.status(200).json({ success: true, advice: null });
  }
};

module.exports = { getAllJobs, getAiMatchAdvice, importFromUrl };
