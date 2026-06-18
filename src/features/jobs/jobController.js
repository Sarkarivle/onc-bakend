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

exports.getAiMatchAdvice = async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = req.user; // From authMiddleware.protect
    const job = await Job.findById(jobId);

    if (!job) throw new Error('Job not found');

    // Get API Key from database
    const geminiSetting = await Settings.findOne({ key: 'GEMINI_API_KEY' });
    const apiKey = geminiSetting ? geminiSetting.value : (process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY');

    const prompt = `
      Act as a Career Expert. Give a personalized, helpful, and friendly advice in HINGLISH for the user based on their profile and job requirements.

      User Profile:
      Name: ${user.name}
      Age: ${user.dob ? 'Calculate from DOB' : '24'}
      Education: ${user.education || 'Graduate'}
      Height: ${user.height || 'N/A'}cm
      Category: ${user.category || 'General'}
      Certificates: ${user.certificates?.join(', ') || 'None'}

      Job Details:
      Title: ${job.title}
      Organization: ${job.organization}
      Requirements: ${job.eligibility?.education || job.description}
      Last Date: ${job.importantDates?.applicationLastDate || 'N/A'}

      Instructions:
      1. Use Hinglish (Hindi + English).
      2. Keep it under 60 words.
      3. Focus on match probability and one action item (like arranging documents or starting prep).
      4. Start with "Hi ${user.name}, ".
    `;

    const data = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const request = https.request(options, response => {
      let body = '';
      response.on('data', d => body += d);
      response.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          const advice = jsonBody.candidates[0].content.parts[0].text;
          res.status(200).json({ status: 'success', advice });
        } catch (e) {
          res.status(200).json({
            status: 'success',
            advice: `${user.name}, aapki profile is job se match karti hai. Apply karne se pehle documents check kar lein.`
          });
        }
      });
    });

    request.on('error', e => {
      res.status(400).json({ status: 'fail', message: e.message });
    });

    request.write(data);
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
