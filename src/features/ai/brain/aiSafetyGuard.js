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
  CLARIFICATION: "Aap kiske baare me kya janna chahte hain? Job, age limit, fees, last date, admit card, resume ya career guidance?",
  OK_RESPONSE: "Theek hai. Aur kuch janna ho to job, career, resume ya scholarship se related sawal pooch sakte hain.",
  CTET_EXPLANATION: "CTET ek eligibility test hai, direct vacancy nahi. Vacancy alag teacher recruitment notifications me aati hai."
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
 * @returns {object|null} A response object or null.
 */
function preLlmChecks(userMessage) {
  // 1. Request normalization check for empty input
  if (!userMessage) {
    return { message: SAFE_RESPONSES.EMPTY_INPUT, answer: SAFE_RESPONSES.EMPTY_INPUT };
  }

  const lowerCaseMessage = userMessage.toLowerCase();

  // 2. Pre-LLM Safety Gate (Injection, DAN, etc.)
  const injectionKeywords = [
    'system prompt', 'api key', 'secret', 'token', 'internal', 'config', 'database',
    'backend', 'technology', 'dan', 'jailbreak', 'ignore your previous', 'developer instruction',
    'mongoose', 'cheerio', 'node.js', 'express.js', 'mongodb', 'runpod', 'openrouter'
  ];
  if (injectionKeywords.some(kw => lowerCaseMessage.includes(kw))) {
    return { message: SAFE_RESPONSES.INJECTION_ATTEMPT, answer: SAFE_RESPONSES.INJECTION_ATTEMPT };
  }

  // 3. Fake Job Safety
  const fakeJobKeywords = [
    'nasa clerk', 'pmo peon', 'google data entry', 'direct joining', 'without exam',
    'guaranteed selection', 'spot offer', 'ministry of memes'
  ];
  if (fakeJobKeywords.some(kw => lowerCaseMessage.includes(kw))) {
    return { message: SAFE_RESPONSES.FAKE_JOB, answer: SAFE_RESPONSES.FAKE_JOB };
  }

  // Handle standard greetings
  if (/^(namaste|hello|hi|hey|hii)$/i.test(lowerCaseMessage)) {
    return { message: SAFE_RESPONSES.GREETING, answer: SAFE_RESPONSES.GREETING };
  }

  // Handle identity questions
  if (lowerCaseMessage.includes('tum kaun ho') || lowerCaseMessage.includes('who are you')) {
    return { message: SAFE_RESPONSES.IDENTITY, answer: SAFE_RESPONSES.IDENTITY };
  }

  // Handle vague inputs that don't need context
  if (/^(batao|aur batao|yes)$/i.test(lowerCaseMessage)) {
    return { message: SAFE_RESPONSES.CLARIFICATION, answer: SAFE_RESPONSES.CLARIFICATION };
  }
  if (/^ok$/i.test(lowerCaseMessage)) {
    return { message: SAFE_RESPONSES.OK_RESPONSE, answer: SAFE_RESPONSES.OK_RESPONSE };
  }

  // Handle CTET vacancy question specifically
  if (lowerCaseMessage.includes('ctet') && lowerCaseMessage.includes('vacancy')) {
    return { message: SAFE_RESPONSES.CTET_EXPLANATION, answer: SAFE_RESPONSES.CTET_EXPLANATION };
  }

  return null; // No pre-LLM block triggered, proceed to LLM
}

/**
 * Post-LLM Safety Filter.
 * Scans the LLM's response for unsafe content and replaces it if found.
 * @param {string} llmResponse - The response text from the LLM.
 * @returns {string} The sanitized and safe response text.
 */
function postLlmFilter(llmResponse) {
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
    'nasa clerk recruitment', '[link]', 'link will be updated',
    'direct joining is confirmed'
  ];

  if (forbiddenContent.some(kw => lowerCaseResponse.includes(kw))) {
    return SAFE_RESPONSES.UNSAFE_OUTPUT;
  }

  // 5. Grounding Rule (Heuristic check for invented details)
  // This is a simplified check. A more robust solution would involve checking against retrieved data.
  const unverifiedPatterns = [
    /last date is \d{1,2} [a-zA-Z]+ \d{4}/, // "last date is 27 July 2026"
    /salary is (around|approx) [₹\d,]+/, // "salary is around 50,000"
    /apply here: http/ // "apply here: http..."
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
 * @returns {object} A response object with success, message, and answer fields.
 */
function shapeResponse(finalText) {
  return {
    success: true,
    message: finalText,
    answer: finalText,
  };
}

module.exports = {
  normalizeRequest,
  preLlmChecks,
  postLlmFilter,
  shapeResponse,
  SAFE_RESPONSES
};