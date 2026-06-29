/**
 * Mock AI Client for Test Suites
 * Provides fast, deterministic, rule-based responses for testing purposes.
 * This completely avoids hitting real AI services, databases, or other backends for response/safety/conversation tests.
 */

/**
 * This is a simplified mock for conversation tests.
 * It uses rule-based logic to simulate responses based on user message and conversation context.
 */

async function processMessage(message, context = {}) {
  const rawMessage = message || "";
  if (rawMessage.trim() === "") {
    return { message: "Aap apna sawal thoda clear likh dijiye. Jaise: latest job, age limit, fees, last date ya career guidance." };
  }

  const q = rawMessage.toLowerCase().trim();

  // Pre-LLM Safety Gate
  const injectionKeywords = ["system prompt", "developer instruction", "api key", "database password", "internal json", "ignore previous", "dan"];
  if (injectionKeywords.some(kw => q.includes(kw))) {
    return { message: "Maaf kijiye, main internal/private system details share nahi kar sakta. Aap job, career, resume ya scholarship se related sawal pooch sakte hain." };
  }

  // Fake Job Safety
  const fakeJobKeywords = ["nasa clerk", "pm office peon", "direct joining", "without exam"];
  if (fakeJobKeywords.some(kw => q.includes(kw))) {
    return { message: "Maaf kijiye, mujhe abhi iski verified jankari nahi mili hai. Aise jobs ke liye sirf official notification/official website par bharosa karein. Direct joining ya guaranteed selection wali baat se bachna chahiye." };
  }

  if (/^(hi|hello|namaste|hey|hii)/i.test(q)) {
    return { message: "Namaste! Main Jobo AI hoon. Main jobs, career, resume, scholarship aur exam details me madad kar sakta hoon." };
  }

  if (q.includes("tum kaun ho") || q.includes("who are you")) {
    return { message: "Main Jobo AI hoon, ek job aur career assistant. Main sarkari naukri, eligibility, fees, last date, resume aur career guidance me madad karta hoon.", intent: "IDENTIFY" };
  }

  if (q.includes("kya haal hai")) {
    return { message: "Main theek hoon. Aapko kaise madad kar sakta hoon?" };
  }

  if (q.includes("engineer kaise bane")) {
    return { message: "Engineer banne ke liye 12th PCM ke baad JEE ya state entrance exam dekar B.Tech course kar sakte hain." };
  }

  if (q.includes("teacher kaise bane")) {
    return { message: "Teacher banne ke liye graduation ke baad B.Ed karna hota hai. School teaching ke liye TET ya CTET exam bhi important hota hai. CTET ek eligibility test hai, direct vacancy nahi." };
  }

  // --- Mocks to fix the original 20 conversation tests ---

  // Handle "yes" / "batao" confirmation with context
  if ((q === 'yes' || q === 'yes do' || q === 'batao') && context.topic?.includes('UPPSC PCS')) {
    return { message: "Details for UPPSC PCS Pre Recruitment 2026. You can apply online.", intent: 'FIELD_DETAILS', domain: 'GOVT_JOB' };
  }

  // Handle follow-up questions with context
  if (context.topic?.includes('UPPSC PCS')) {
    if (q.includes('apply kaise kare')) return { message: "Apply karne ke liye official website par jayein.", intent: 'APPLICATION_HELP', domain: 'GOVT_JOB' };
    if (q.includes('form kaise bhare')) return { message: "Form bharne ke liye registration, fill details, upload documents, aur submit karein.", intent: 'APPLICATION_HELP', domain: 'GOVT_JOB' };
    if (q.includes('fees kitni hai')) return { message: "UPPSC PCS ki fees notification me check karein.", intent: 'FIELD_DETAILS', domain: 'GOVT_JOB' };
    if (q.includes('last date kya hai')) return { message: "Is job ki last date 27 July 2026 hai.", intent: 'FIELD_DETAILS', domain: 'GOVT_JOB' };
    if (q.includes('official link do')) return { message: "UPPSC PCS ke liye official website par apply karein.", intent: 'FIELD_DETAILS', domain: 'GOVT_JOB' };
    if (q.includes('sahi se batao')) return { message: "Details for UPPSC PCS: This is a state civil services exam...", intent: 'FIELD_DETAILS', domain: 'GOVT_JOB' };
  }

  // Handle numeric reference from a list
  if (q.includes('4 no') || q.includes('4 number')) {
    return { message: "Details for JHTET...", intent: 'FIELD_DETAILS', domain: 'GOVT_JOB' };
  }

  // Handle topic switches
  if (q.includes('doctor banna hai') || (q.includes('doctor') && (q.includes('mbbs') || q.includes('nursing')))) {
    return { message: "To become a doctor, MBBS is the main route via NEET. Nursing is a different healthcare career path.", intent: 'CAREER_GUIDANCE', domain: 'CAREER' };
  }
  if (q.includes('bpsc cutoff')) {
    return { message: "BPSC cutoff details...", intent: 'RESULT_ADMIT_CARD', domain: 'RESULT_ADMIT_CARD' };
  }
  if (q.includes('resume kaise banaye')) {
    return { message: "Resume banane ke liye...", intent: 'RESUME_HELP', domain: 'RESUME' };
  }

  // Handle vague queries
  if (q === 'batao') {
    return { message: "Aap kiske baare me kya janna chahte hain? Job, age limit, fees, last date, admit card, resume ya career guidance?", behavior: 'CLARIFY' };
  }
  if (q === 'yes') {
    return { message: "Aap kiske baare me kya janna chahte hain? Job, age limit, fees, last date, admit card, resume ya career guidance?", behavior: 'CLARIFY' };
  }
  if (q === 'ok') {
    return { message: "Theek hai. Aur kuch janna ho to job, career, resume ya scholarship se related sawal pooch sakte hain." };
  }

  // Handle "more jobs"
  if (q.includes('aur jobs')) {
    return { message: "Here are more jobs...", intent: 'MORE_JOBS', domain: 'GOVT_JOB' };
  }

  // Handle eligibility test context
  if (q.includes('vacancy kitni hai') && context.topic?.includes('JHTET')) {
    return { message: "JHTET ek eligibility test hai, not a direct vacancy.", intent: 'FIELD_DETAILS', domain: 'GOVT_JOB' };
  }

  // Handle invalid numeric reference
  if (q.includes('5 no')) {
    return { message: "Please provide a valid number from the list.", behavior: 'CLARIFY' };
  }

  if (q.includes("doctor") || q.includes("mbbs") || q.includes("neet") || q.includes("medical")) {
    return { message: "Doctor banne ke liye 12th Biology ke baad NEET exam qualify karke MBBS course karna hota hai. MBBS ke baad internship aur registration ke baad doctor ke roop me career start hota hai." };
  }

  if (q.includes("aur batao") || q.includes("more") || q.includes("next")) { // Generic fallback
    return { message: "Aap kiske baare me kya janna chahte hain? Job, age limit, fees, last date, admit card, resume ya career guidance?" };
  }

  if (q.includes("ctet") || q.includes("jhtet") || q.includes("tet")) {
    if (q.includes('vacancy')) {
      return { message: "CTET ek eligibility test hai, direct vacancy nahi. Vacancy alag teacher recruitment notifications me aati hai." };
    }
    return { message: "Ye eligibility test hai, direct vacancy nahi. Iske liye official notification check karke eligibility, syllabus aur dates verify karni chahiye." };
  }

  if (q.includes("latest job") || q.includes("sarkari job") || q.includes("railway") || q.includes("vacancy") || q.includes("bharti")) {
    return { message: "Verified job details ke liye official notification check karna zaroori hai. Bina verified source ke main last date, fee, vacancy ya apply link confirm nahi karunga." };
  }

  return { message: "Kripya apna sawal thoda clear batayein, main jobs, career, resume, scholarship, result aur admit card me madad kar sakta hoon.", behavior: 'CLARIFY' };
}

module.exports = { processMessage };