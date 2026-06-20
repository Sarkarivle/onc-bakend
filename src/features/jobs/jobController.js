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

    // Try multiple possible keys for Gemini API
    const geminiSetting = await Settings.findOne({ key: 'GEMINI_API_KEY' });
    const legacySetting = await Settings.findOne({ key: 'API_KEY' });

    const apiKey = (geminiSetting && geminiSetting.value) ||
                   (legacySetting && legacySetting.value) ||
                   process.env.GEMINI_API_KEY ||
                   'YOUR_GEMINI_API_KEY';

    const userAge = calculateAge(user.dob);

    const prompt = `
      Act as a Career Expert. Analyze this job for the user and return a JSON object for a "Good Match" section.

      User Details:
      - Name: ${user.name}, Age: ${userAge}, Education: ${user.education || 'Not Specified'}
      - Category: ${user.category || 'General'}, State: ${user.domicileState || 'Uttar Pradesh'}

      Job Details:
      - Title: ${job.title}, Org: ${job.organization}
      - Required Education: ${job.eligibility?.education || 'Check Notification'}
      - Age Limit: ${job.eligibility?.ageLimit || 'N/A'}
      - Fees: ${JSON.stringify(job.applicationFee)}

      Return ONLY a JSON object with these EXACT keys:
      1. "advice": A 3-line Hinglish overview.
      2. "age_status": Short (e.g. "Fit")
      3. "age_desc": Hinglish explanation (e.g. "Aapki age (22) is job ke age limit ke andar hai.")
      4. "edu_status": Short (e.g. "Match")
      5. "edu_desc": Hinglish explanation (e.g. "Aap 12th pass hain, jo is job ke liye required hai.")
      6. "loc_desc": Hinglish explanation (e.g. "Aapka state preference Uttar Pradesh hai.")
      7. "cat_desc": Hinglish explanation (e.g. "Aapki category OBC hai, jo is vacancy me eligible hai.")
      8. "comp_desc": Hinglish explanation about competition (e.g. "Is job me competition level Medium hai.")
      9. "success_desc": Hinglish explanation about selection chances.
      10. "ai_tip": A short helpful tip (e.g. "Agar aap abhi se taiyari shuru karte hain toh...").
      11. "fee_text": Calculated fee.
      12. "urgency": Days left.
    `;

    const requestData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json" }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const request = https.request(options, response => {
      let body = '';
      response.on('data', d => body += d);
      response.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          if (jsonBody.candidates && jsonBody.candidates[0]) {
            const result = JSON.parse(jsonBody.candidates[0].content.parts[0].text);
            res.status(200).json({ status: 'success', ...result });
          } else {
            res.status(200).json({ status: 'success', advice: null });
          }
        } catch (e) {
          res.status(200).json({ status: 'success', advice: null });
        }
      });
    });

    request.on('error', e => {
      console.error('HTTPS Request Error:', e);
      res.status(200).json({
        status: 'success',
        advice: null
      });
    });

    request.write(requestData);
    request.end();

  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
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
