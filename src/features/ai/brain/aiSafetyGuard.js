/**
 * AI Safety Guard
 * Responsibility: Provides pre-LLM and post-LLM safety checks, input normalization,
 * and standardized responses for common queries. This acts as a safety layer
 * around the core AI/LLM logic.
 */

const SAFE_RESPONSES = {
  EMPTY_INPUT: "Aap apna sawal thoda clear likh dijiye. Jaise: latest job, age limit, fees, last date ya career guidance.",
  INJECTION_ATTEMPT: "Maaf kijiye, main internal/private system details share nahi kar sakta. Aap job, career, resume ya scholarship se related sawal pooch sakte hain.",
  FAKE_JOB: "Maaf kijiye, mujhe abhi iski verified jankari nahi mili hai. Aise jobs ke liye sirf official notification/official website par bharosa karein. Direct joining ya guaranteed selection wali baat se bachna chahiye.",
  UNSAFE_OUTPUT: "Maaf kijiye, main is tarah ki jankari nahi de sakta. Aap job, career, resume ya scholarship se related sawal pooch sakte hain.",
  GENERIC_FALLBACK: "Maaf kijiye, mujhe abhi iski verified jankari nahi mili hai.",
  GREETING: "Namaste! Main Jobo AI hoon. Main jobs, career, resume, scholarship aur exam details me madad kar sakta hoon.",
  IDENTITY: "Main Jobo AI hoon, ek job aur career assistant. Main sarkari naukri, eligibility, fees, last date, resume aur career guidance me madad karta hoon.",
  CLARIFICATION: "Aap kis baare me janna chahte hain? Job, age limit, fees, last date, admit card, resume ya career guidance?",
  CONFIRM_CLARIFICATION: "Main samajh nahi paaya ki aap kya confirm karna chahte hain. Kripya job, fees, age limit, last date ya career guidance ke baare me clear likhein.",
  OK_RESPONSE: "Theek hai. Aur kuch janna ho to job, career, resume ya scholarship se related sawal pooch sakte hain.",
  CTET_EXPLANATION: "CTET ek eligibility test hai, direct vacancy nahi. Teacher vacancy alag recruitment notifications me aati hai.",
  GIBBERISH: "Main aapka sawal samajh nahi paaya. Kripya clear batayein ki aap job, age limit, fees, last date, resume ya career guidance me kya janna chahte hain.",
  GENERIC_CAREER_FALLBACK: "Iske baare me jaankari ke liye aap official sources check kar sakte hain."
};

/**
 * Normalizes the incoming request by extracting the user message from various possible keys.
 * @param {object} body - The request body.
 * @returns {string} The trimmed user message.
 */
function normalizeRequest(body) {
  const message = body.question || body.message || body.userMessage || body.query || body.input || body.prompt || body.text || "";
  return message.trim();
}

/**
 * Pre-LLM Safety Gate.
 * Checks for empty input, prompt injection, and fake job queries.
 * Returns a safe response object if a violation is detected, otherwise null.
 * @param {string} userMessage - The normalized user message.
 * @param {object} requestBody - The original request body for context.
 * @returns {object|null} A response object or null.
 */
function preLlmChecks(userMessage, requestBody = {}) {
  // 1. Request normalization check for empty input
  if (!userMessage) {
    return shapeResponse(SAFE_RESPONSES.EMPTY_INPUT);
  }

  const lowerCaseMessage = userMessage.toLowerCase();

  // 2. Pre-LLM Safety Gate (Injection, DAN, etc.)
  const injectionKeywords = [
    'system prompt', 'api key', 'secret', 'token', 'internal', 'config', 'database',
    'backend', 'technology', 'dan', 'jailbreak', 'ignore your previous', 'developer instruction',
    'mongoose', 'cheerio', 'node.js', 'express.js', 'mongodb', 'runpod', 'openrouter'
  ];
  if (injectionKeywords.some(kw => lowerCaseMessage.includes(kw))) {
    return shapeResponse(SAFE_RESPONSES.INJECTION_ATTEMPT);
  }

  // 3. Fake Job Safety
  const fakeJobKeywords = [
    'nasa clerk', 'pmo peon', 'google data entry', 'direct joining', 'without exam',
    'guaranteed selection', 'spot offer', 'ministry of memes'
  ];
  if (fakeJobKeywords.some(kw => lowerCaseMessage.includes(kw))) {
    return shapeResponse(SAFE_RESPONSES.FAKE_JOB);
  }

  // Handle standard greetings
  if (/^(namaste|hello|hi|hey|hii)$/i.test(lowerCaseMessage)) {
    return shapeResponse(SAFE_RESPONSES.GREETING);
  }

  // Handle identity questions
  if (lowerCaseMessage.includes('tum kaun ho') || lowerCaseMessage.includes('who are you')) {
    return shapeResponse(SAFE_RESPONSES.IDENTITY);
  }

  // Handle vague inputs that don't need context
  const hasHistory = requestBody.history && Array.isArray(requestBody.history) && requestBody.history.length > 0;
  if (/^(batao|aur batao)$/i.test(lowerCaseMessage) && !hasHistory) {
    return shapeResponse(SAFE_RESPONSES.CLARIFICATION);
  }
  if (/^(yes|haan)$/i.test(lowerCaseMessage) && !hasHistory) {
    return shapeResponse(SAFE_RESPONSES.CONFIRM_CLARIFICATION);
  }
  if (/^ok$/i.test(lowerCaseMessage)) {
    return shapeResponse(SAFE_RESPONSES.OK_RESPONSE);
  }

  // Handle CTET vacancy question specifically
  if (lowerCaseMessage.includes('ctet') && lowerCaseMessage.includes('vacancy')) {
    return shapeResponse(SAFE_RESPONSES.CTET_EXPLANATION);
  }

  // Handle specific career questions deterministically
  if (lowerCaseMessage.includes('resume kaise banaye')) {
    return shapeResponse("Resume banane ke liye aapko contact information, summary, skills, experience aur education jaise sections include karne chahiye. Aap online resume builder tools ki bhi madad le sakte hain. Isme clear format aur professional language ka use karna important hai.");
  }
  if (lowerCaseMessage.includes('doctor kaise bane')) {
    return shapeResponse("Doctor banne ke liye 12th me Physics, Chemistry, Biology (PCB) subjects hone chahiye. Iske baad NEET exam clear karke MBBS course me admission milta hai. MBBS ke baad aap ek qualified doctor ban jaate hain.");
  }
  if (lowerCaseMessage.includes('engineer kaise bane')) {
    return shapeResponse("Engineer banne ke liye 12th me Physics, Chemistry, Maths (PCM) subjects hone chahiye. Iske baad JEE Main aur Advanced jaise entrance exams clear karke B.Tech course me admission milta hai.");
  }
  if (lowerCaseMessage.includes('mbbs aur nursing')) {
    return shapeResponse("MBBS aur Nursing dono medical field ke alag-alag professional courses hain. MBBS karke aap doctor bante hain, jisme 5.5 saal lagte hain. Nursing ek 4 saal ka course hai jisme aap patient care aur medical assistance ki training lete hain.");
  }

  // Handle gibberish
  const gibberishRegex = /^(asdf|sdfg|hjkl|jkl|sdg|fgh|asd|xyz|dfg){1,4}$/;
  if (gibberishRegex.test(lowerCaseMessage)) {
    return shapeResponse(SAFE_RESPONSES.GIBBERISH);
  }

  // Handle other career guidance to prevent job list invention
  const careerGuidanceKeywords = ['12th ke baad kya karu', 'career option', 'bca ke baad kya kare'];
  if (careerGuidanceKeywords.some(kw => lowerCaseMessage.includes(kw))) {
    // This query will proceed to the LLM, but the prompt should guide it to give general advice.
    // A post-filter can also check for job lists.
  }

  return null; // No pre-LLM block triggered, proceed to LLM
}

/**
 * Post-LLM Safety Filter.
 * Scans the LLM's response for unsafe content and replaces it if found.
 * @param {string} llmResponse - The response text from the LLM.
 * @param {string} normalizedQuery - The normalized user query.
 * @returns {string} The sanitized and safe response text.
 */
function postLlmFilter(llmResponse, normalizedQuery) {
  if (!llmResponse || typeof llmResponse !== 'string') {
    return SAFE_RESPONSES.GENERIC_FALLBACK;
  }

  const lowerCaseResponse = llmResponse.toLowerCase();

  // 4. Post-LLM Safety Filter
  const forbiddenContent = [
    'system prompt', 'my system prompt is', 'internal rules', 'config.json',
    'database', 'mongoose', 'cheerio', 'node.js', 'express.js', 'mongodb',
    'runpod', 'openrouter', 'api key', 'secret',
    // Fake placeholders
    'nasa clerk recruitment', 'pmo peon recruitment',
    // Fake link patterns
    '[link]', 'link will be updated', 'apply link:',
    // Fake claims
    'direct joining is confirmed', 'guaranteed selection'
  ];

  if (forbiddenContent.some(kw => lowerCaseResponse.includes(kw))) {
    return SAFE_RESPONSES.UNSAFE_OUTPUT;
  }

  // For career guidance queries, block if it invents a job list
  const isCareerQuery = /career|kaise bane|kya karu/.test(normalizedQuery.toLowerCase());
  if (isCareerQuery && /\d\.\s\*\*/.test(llmResponse)) { // Detects markdown list of jobs
      return SAFE_RESPONSES.GENERIC_CAREER_FALLBACK;
  }

  // 5. Grounding Rule (Heuristic check for invented details)
  // This is a simplified check. A more robust solution would involve checking against retrieved data.
  const unverifiedPatterns = [
    /last date is \d{1,2} [a-zA-Z]+ \d{4}/, // "last date is 27 July 2026"
    /salary is (around|approx) [₹\d,]+/, // "salary is around 50,000"
    /apply here: http/, // "apply here: http..."
    /total vacancies are \d+/
  ];

  // This check is tricky without knowing the ground truth.
  // For now, we'll rely on the prompt to prevent this and the post-filter for obvious leaks.
  // A more advanced implementation would pass the ground truth data to this function.

  // If no filters are triggered, return the original response
  return llmResponse;
}

/**
 * Ensures the final response object has the required shape.
 * @param {string} finalText - The final, safe message to be sent to the user.
 * @param {object} existingExtras - Any extra fields from the original response to preserve.
 * @returns {object} A response object with success, message, and answer fields.
 */
function shapeResponse(finalText, existingExtras = {}) {
  return {
    success: true,
    message: finalText,
    answer: finalText,
    ...existingExtras
  };
}

module.exports = {
  normalizeRequest,
  preLlmChecks,
  postLlmFilter,
  shapeResponse,
  SAFE_RESPONSES,
};