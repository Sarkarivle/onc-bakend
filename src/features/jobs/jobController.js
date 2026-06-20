const axios = require('axios');
const cheerio = require('cheerio');

exports.importFromUrl = async (req, res) => {
  try {
    const { url, category } = req.body;
    if (!url) throw new Error('URL is required');

    // 1. Raw Data nikalna (Scraping)
    const pageResponse = await axios.get(url);
    const $ = cheerio.load(pageResponse.data);

    // Sirf main content ka text uthana (SarkariResult specific)
    const rawText = $('body').text().replace(/\s\s+/g, ' ').substring(0, 5000);

    // 2. RunPod AI Settings
    const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
    const runpodUrl = (runpodSetting && runpodSetting.value) || "https://1krx0rrhqju1ff-11434.proxy.runpod.net/api/generate";

    // 3. AI ko instruct karna data filter karne ke liye (Dual Purpose: JSON + HTML Template)
    const prompt = `
      You are SarkariVLE’s Automated Job Data Extractor and Template Generator.
      Extract job details from the RAW TEXT below and return a valid JSON object ONLY.

 sv-box, sv-h1, sv-h2, sv-about, sv-table.
      - Rewrite in simple student-friendly Hinglish.
      - Replace any website name with "ONC".
      - Wrap Last Date values in <span style="color: #ff0000;">DATE</span>.
      - Important Links heading MUST be <h2 class="sv-h2" style="color: #ff66cc;">Important Links</h2>.

      JSON STRUCTURE:
      {
        "jobData": {
          "title": "Full Job Name",
          "organization": "Org Name",
          "location": "State",
          "totalVacancy": "Count",
          "salary": "Pay Scale",
          "importantDates": {"applicationStartDate": "DD/MM/YYYY", "applicationLastDate": "DD/MM/YYYY", "feePaymentLastDate": "DD/MM/YYYY", "examDate": "Date"},
          "applicationFee": {"generalObcEws": "Amount", "scStPh": "Amount"},
          "eligibility": {"education": "Requirements", "minAge": "18", "maxAge": "40"},
          "description": "Summary"
        },
        "htmlTemplate": "...Full SarkariVLE Structured HTML Block..."
      }

      RAW TEXT: ${rawText}
    `;

    const aiResponse = await axios.post(runpodUrl, {
      model: "onc-ai",
      prompt: `System: You are an expert data extractor. Return a JSON object containing "jobData" and "htmlTemplate". No markdown.\n\nUser: ${prompt}\n\nAssistant JSON:`,
      stream: false,
      options: { temperature: 0.1 }
    });

    let resultText = aiResponse.data.response;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(resultText);

    const jobData = result.jobData;
    jobData.fullHtmlContent = result.htmlTemplate;
    jobData.applyLink = url;

    // Default Category agar user ne nahi di
    jobData.category = category || jobData.category || 'Jobs';

    // 4. Database mein save karna
    const newJob = await Job.create(jobData);
    res.status(201).json({ status: 'success', data: newJob });

  } catch (err) {
    console.error('AI Scraping Error:', err.message);
    res.status(400).json({ status: 'fail', message: 'Could not process URL: ' + err.message });
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

    const lastDateStr = job.importantDates?.applicationLastDate || '';
    let daysLeftText = "N/A";
    if (lastDateStr) {
      try {
        let lastDate;
        if (lastDateStr.includes('/')) {
          const parts = lastDateStr.split('/');
          lastDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          lastDate = new Date(lastDateStr);
        }
        const diffTime = lastDate - new Date();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) daysLeftText = "Expired";
        else if (diffDays === 0) daysLeftText = "0 (Today is Last Day)";
        else daysLeftText = `${diffDays} days remaining`;
      } catch (e) { daysLeftText = "N/A"; }
    }

    const prompt = `
      Act as a Career Expert. Analyze this job and return a JSON object.
      STRICT RULE: Only use provided facts. Do not guess.

      User: ${user.name}, Edu: ${user.education}, Cat: ${user.category}, Age: ${userAge}
      Job: ${job.title}, Vacancies: ${job.totalVacancy}, Last Date: ${lastDateStr} (${daysLeftText})
      Fees: Gen: ₹${job.applicationFee?.generalObcEws || '0'}, SC/ST: ₹${job.applicationFee?.scStPh || '0'}

      Return JSON with:
      - "advice": Hinglish overview (3 lines).
      - "age_status": "Fit", "Over", or "Limit"
      - "age_desc": Hinglish explanation.
      - "edu_status": "Match" or "No Match"
      - "edu_desc": Hinglish explanation.
      - "loc_desc": Hinglish state match.
      - "cat_desc": Hinglish category info.
      - "comp_desc": Hinglish competition.
      - "success_desc": Hinglish chances.
      - "ai_tip": Hinglish tip.
      - "fee_text": Personalized fee for ${user.category} category.
      - "urgency": Use exactly "${daysLeftText}" to write a natural Hinglish response. If 0 days, say "Aaj aakhri din hai". If X days, say "Sirf X din bache hain".
      - "vacancy_text": "${job.totalVacancy} Posts available".
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
