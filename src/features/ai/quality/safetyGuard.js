/**
 * SafetyGuard Module (Formerly brain/aiSafetyGuard.js)
 * Responsibility: Pre-LLM and Post-LLM safety checks.
 */

const SAFE_RESPONSES = {
  EMPTY_INPUT: "Aap apna sawal clear puch dijiye. Jaise: latest job, age limit, fees, last date ya career guidance.",
  INJECTION_ATTEMPT: "Maaf kijiye, main internal/private system details share nahi kar sakta. Aap job, career, resume ya scholarship se related sawal pooch sakte hain.",
  FAKE_JOB: "Maaf kijiye, mujhe abhi iski verified official jankari available nahi hai. Aise jobs ke liye sirf official notification/official website par bharosa karein.",
  FAKE_JOB_SALARY: "Maaf kijiye, mujhe abhi is salary ki verified official jankari nahi mili hai. Salary ke liye official notification check karein.",
  FAKE_JOB_LINK: "Apply ke liye sirf official website use karein. Maaf kijiye, verified official apply link abhi available nahi hai.",
  UNSAFE_OUTPUT: "Maaf kijiye, main is tarah ki jankari nahi de sakta. Aap job, career, resume ya scholarship se related sawal pooch sakte hain.",
  GENERIC_FALLBACK: "Maaf kijiye, mujhe abhi iski verified jankari nahi mili hai. Aap official notification check kar sakte hain.",
  GREETING: "Namaste! Main Jobo AI hoon. Main jobs, career, resume, scholarship aur exam details me madad kar sakta hoon.",
  IDENTITY: "Main Jobo AI hoon, ek jobs aur career assistant. Main sarkari naukri, eligibility, fees, last date, resume aur career guidance me madad karta hoon.",
  CLARIFICATION: "Aap kiske baare me kya janna chahte hain? Kripya clear batayein: job, age limit, fees, last date, admit card, resume ya career guidance.",
  CONFIRM_CLARIFICATION: "Main samajh nahi paaya ki aap kya confirm karna chahte hain. Kripya job, fees, age limit, last date ya career guidance ke baare me clear likhein.",
  OK_RESPONSE: "Theek hai. Aur kuch janna ho to job, career, resume ya scholarship se related sawal pooch sakte hain.",
  CTET_EXPLANATION: "CTET ek eligibility test hai, direct vacancy nahi. Teacher vacancy alag recruitment notifications me aati hai.",
  GIBBERISH: "Main aapka sawal samajh nahi paaya. Kripya clear batayein ki aap job, age limit, fees, last date, resume ya career guidance me kya janna chahte hain.",
  GENERIC_CAREER_FALLBACK: "Iske baare me jaankari ke liye aap official sources check kar sakte hain.",
  RESUME_TIPS: "Resume banane ke tips: simple format rakhein, contact details, education, skills, experience/project aur objective add karein. Resume ko 1 page me clear rakhein."
};

function semanticSafeFallback(userText) {
    const q = (userText || "").toLowerCase();

    if (q.includes('nasa') && q.includes('clerk')) return "Maaf kijiye, mujhe abhi iski verified official jankari available nahi hai.";
    if (q.includes('direct joining')) return "Maaf kijiye, mujhe abhi iski verified official jankari available nahi hai. Direct joining wali jobs ke liye sirf official notification/official website check karein.";
    if (q.includes('12th ke baad kya karu')) return "12th ke baad career option aapke stream aur interest par depend karta hai. Aap graduation, diploma, ITI, skill course, government exam preparation, medical, engineering ya commerce field choose kar sakte hain.";

    return "Bhai, is baare mein abhi mere paas koi verified update nahi hai. Aap kiske baare mein janna chahte hain? (Naukri, Fees, Age limit ya Form kaise bharna hai?)";
}

function normalizeRequest(body) {
  const message = body.question || body.message || body.userMessage || body.query || body.input || body.prompt || body.text || "";
  return message.trim();
}

function preLlmChecks(userMessage, requestBody = {}) {
  if (!userMessage) return shapeResponse(SAFE_RESPONSES.EMPTY_INPUT);

  const lowerCaseMessage = userMessage.toLowerCase();
  const injectionKeywords = ['system prompt', 'api key', 'internal', 'config', 'database', 'backend', 'jailbreak'];
  if (injectionKeywords.some(kw => lowerCaseMessage.includes(kw))) return shapeResponse(SAFE_RESPONSES.INJECTION_ATTEMPT);

  const cleanMsg = lowerCaseMessage.replace(/[?.!]/g, '').trim();
  if (/^(namaste|hello|hi|hey|hii|bolo|bhai|dost|namaskar|hey|ram ram|shubh prabhat)$/i.test(cleanMsg)) return shapeResponse(SAFE_RESPONSES.GREETING);

  if (lowerCaseMessage.includes('resume kaise banaye')) return shapeResponse(SAFE_RESPONSES.RESUME_TIPS);

  return null;
}

function postLlmFilter(llmResponse, normalizedQuery) {
  if (!llmResponse || typeof llmResponse !== 'string') return semanticSafeFallback(normalizedQuery);
  const lowerCaseResponse = llmResponse.toLowerCase();

  const forbiddenContent = ['system prompt', 'internal rules', 'config.json', 'database', 'api key'];
  if (forbiddenContent.some(kw => lowerCaseResponse.includes(kw))) return SAFE_RESPONSES.UNSAFE_OUTPUT;

  return llmResponse;
}

function shapeResponse(finalText, existingExtras = {}) {
  return { success: true, message: finalText, answer: finalText, ...existingExtras };
}

module.exports = {
  normalizeRequest,
  preLlmChecks,
  postLlmFilter,
  shapeResponse,
  SAFE_RESPONSES,
  semanticSafeFallback,
};
