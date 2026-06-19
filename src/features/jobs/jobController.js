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
      Act as a Career Expert. Give a HIGHLY PERSONALIZED, helpful, and friendly advice in HINGLISH (Hindi + English) for the user based on their profile and job requirements.

      User Details:
      - Name: ${user.name}
      - Current Age: ${userAge}
      - Education Qualification: ${user.education || 'Not Specified'}
      - Physical: Height ${user.height || 'N/A'}cm, Weight ${user.weight || 'N/A'}kg
      - Category/Caste: ${user.category || 'General'}
      - Skills/Certificates: ${user.certificates?.length > 0 ? user.certificates.join(', ') : 'None'}
      - Resident of: ${user.domicileState || 'Uttar Pradesh'}

      Job Details:
      - Job Title: ${job.title}
      - Organization: ${job.organization}
      - Vacancies: ${job.totalVacancy || 'N/A'}
      - Required Education: ${job.eligibility?.education || 'Check Notification'}
      - Age Limit: ${job.eligibility?.ageLimit || 'N/A'}
      - Closing Date: ${job.importantDates?.applicationLastDate || 'N/A'}

      Instructions:
      1. MUST START with a personalized greeting: "Hi ${user.name}, ".
      2. ANALYZE if they are a good fit. Mention their specific education (${user.education}) or age if it's relevant to the job.
      3. Use a motivating tone like an elder brother or career guide.
      4. Use Hinglish naturally (e.g., "Aapki education qualification is job ke liye perfect hai...").
      5. Keep the response between 3-4 lines maximum.
      6. End with one specific actionable advice.
    `;

    const requestData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    });

    // Use v1beta for better compatibility if v1 fails, or vice versa
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const request = https.request(options, response => {
      let body = '';
      response.on('data', d => body += d);
      response.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);

          if (jsonBody.error) {
            console.error('Gemini API Error:', jsonBody.error);
            return res.status(200).json({
                status: 'success',
                advice: `Hi ${user.name}, aapki profile is job se kaafi match karti hai! Ek baar eligibility check karke apply zaroor karein.`
            });
          }

          if (jsonBody.candidates && jsonBody.candidates[0] && jsonBody.candidates[0].content) {
            const advice = jsonBody.candidates[0].content.parts[0].text;
            res.status(200).json({ status: 'success', advice });
          } else {
            throw new Error('No candidates in response');
          }
        } catch (e) {
          console.error('AI Processing Error:', e.message);
          res.status(200).json({
            status: 'success',
            advice: `Hi ${user.name}, ye job aapke liye ek accha mauka ho sakta hai. Don't miss the deadline!`
          });
        }
      });
    });

    request.on('error', e => {
      console.error('HTTPS Request Error:', e);
      res.status(200).json({
        status: 'success',
        advice: `Hi ${user.name}, server connectivity issue hai, par ye job aapke career ke liye acchi lag rahi hai.`
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
