const Job = require('./jobModel');
const Settings = require('../settings/settingsModel');
const https = require('https');

exports.getAllJobs = async (req, res) => {
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

exports.addJobFromJson = async (req, res) => {
  try {
    const { jobJson, category } = req.body;
    const parsedData = typeof jobJson === 'string' ? JSON.parse(jobJson) : jobJson;

    const jobData = {
      ...parsedData,
      totalVacancy: parsedData.totalVacancy || parsedData.vacancy || parsedData.totalPost || parsedData.total_vacancy || parsedData.vacancy_count || 'N/A',
      salary: parsedData.salary || parsedData.package || 'Not Disclosed',
      category: category || parsedData.category || 'General',
    };

    if (parsedData.importantDates && parsedData.importantDates.applicationLastDate) {
      const dateParts = parsedData.importantDates.applicationLastDate.split('/');
      if (dateParts.length === 3) {
        jobData.lastDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
      } else {
        jobData.lastDate = new Date(parsedData.importantDates.applicationLastDate);
      }
    }

    const newJob = await Job.create(jobData);
    res.status(201).json({ status: 'success', data: newJob });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

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

exports.getAiMatchAdvice = async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = req.user;
    const job = await Job.findById(jobId);

    if (!job) throw new Error('Job not found');

    // RunPod Settings se URL nikalna
    const Settings = require('../settings/settingsModel');
    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    const userAge = calculateAge(user.dob);

    const prompt = `
      Act as a Career Expert. Analyze this job for the user and return a JSON object ONLY.
      STRICT RULE: Only use the provided Job and User data. Do not hallucinate or make up facts.

      User Profile:
      - Name: ${user.name}
      - Education: ${user.education || 'Not Specified'}
      - Category: ${user.category || 'General'}
      - State: ${user.domicileState || 'UP'}
      - Age: ${userAge}

      Job Details:
      - Title: ${job.title}
      - Vacancies: ${job.totalVacancy || 'N/A'}
      - Required Edu: ${job.eligibility?.education || 'N/A'}
      - Age Limit: ${job.eligibility?.ageLimit || 'N/A'}
      - Application Fee: General/OBC: ₹${job.applicationFee?.generalObcEws || '0'}, SC/ST: ₹${job.applicationFee?.scStPh || '0'}
      - Last Date: ${job.importantDates?.applicationLastDate || 'N/A'}

      Return a JSON object with these EXACT keys:
      - "advice": Hinglish overview (max 3 lines).
      - "age_status": "Fit", "Over", or "Limit"
      - "age_desc": Hinglish explanation (e.g. "Aapki age (20) limit ke andar hai.")
      - "edu_status": "Match" or "No Match"
      - "edu_desc": Hinglish explanation (e.g. "Aap ${user.education || '12th'} hain, aur isme graduation chahiye.")
      - "loc_desc": Hinglish explanation about state match.
      - "cat_desc": Hinglish explanation about category eligibility.
      - "comp_desc": Hinglish competition info.
      - "success_desc": Hinglish chances.
      - "ai_tip": Hinglish shortcut tip.
      - "fee_text": Personalized fee for ${user.category} category (e.g. "Aapki fee ₹500 hai").
      - "urgency": Personalized Hinglish text about how much time is left (e.g. "Bhai sirf 2 din bache hain!", "Abhi 10 din bache hain aaram se bharo", "Aaj aakhri din hai!"). STRICTLY NO DATES, only human-like relative time.
      - "vacancy_text": Total vacancies count (e.g. "${job.totalVacancy} Posts available").

      Response MUST be valid JSON only.
    `;

    const axios = require('axios');
    const aiResponse = await axios.post(runpodUrl, {
        model: "onc-ai",
        prompt: `System: You are an expert career assistant. Return valid JSON only.\n\nUser: ${prompt}\n\nAssistant JSON:`,
        stream: false,
        options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response;
    // Remove potential markdown code blocks
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    const result = JSON.parse(resultText);
    res.status(200).json({ status: 'success', ...result });

  } catch (err) {
    console.error('RunPod Analysis Error:', err.message);
    res.status(200).json({
      status: 'success',
      advice: null
    });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(404).json({ status: 'fail', message: 'Job not found' });
  }
};
