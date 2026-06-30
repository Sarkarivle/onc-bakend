/**
 * SafetyGuard Module (Neural-First Evolution)
 * Responsibility: Guardrails and normalization using Neural checks.
 */

const SAFE_RESPONSES = {
  EMPTY_INPUT: "Aap apna sawal clear puch dijiye. Jaise: latest job, age limit, fees, last date ya career guidance.",
  INJECTION_ATTEMPT: "Maaf kijiye, main internal/private system details share nahi kar sakta. Aap job, career, resume ya scholarship se related sawal pooch sakte hain.",
  FAKE_JOB: "Maaf kijiye, mujhe abhi iski verified official jankari available nahi hai. Aise jobs ke liye sirf official notification/official website par bharosa karein.",
  UNSAFE_OUTPUT: "Maaf kijiye, main is tarah ki jankari nahi de sakta. Aap job, career, resume ya scholarship se related sawal pooch sakte hain.",
  GENERIC_FALLBACK: "Maaf kijiye, मुझे अभी इसकी verified जानकारी नहीं मिली है। आप official notification check कर सकते हैं।",
  GREETING: "Namaste! Main Jobo AI hoon. Main jobs, career, resume, scholarship aur exam details me madad kar sakta hoon.",
  IDENTITY: "Main Jobo AI hoon, ek jobs aur career assistant.",
  CLARIFICATION: "Aap kiske baare me kya janna chahte hain? Kripya clear batayein.",
  OK_RESPONSE: "Theek hai. Aur kuch janna ho to job, career, resume ya scholarship se related sawal pooch sakte hain."
};

/**
 * Neural Fallback - Replaced hardcoded keyword checks with a broad safety net.
 */
function semanticSafeFallback(userText) {
    return "Bhai, is baare mein abhi mere paas koi verified update nahi hai. Aap kiske baare mein janna chahte hain? (Naukri, Fees, Age limit ya Form kaise bharna hai?)";
}

function normalizeRequest(body) {
  const message = body.question || body.message || body.userMessage || body.query || body.input || body.prompt || body.text || "";
  return message.trim();
}

/**
 * Pre-LLM Checks now rely on SmartGateway (Neural Cluster) for most things.
 * This function handles only structural/emergency issues.
 */
function preLlmChecks(userMessage, requestBody = {}) {
  if (!userMessage || userMessage.length < 2) return shapeResponse(SAFE_RESPONSES.EMPTY_INPUT);
  return null;
}

/**
 * Filter LLM output for system leaks.
 */
function postLlmFilter(llmResponse, normalizedQuery) {
  if (!llmResponse || typeof llmResponse !== 'string') return semanticSafeFallback(normalizedQuery);
  const lowerCaseResponse = llmResponse.toLowerCase();

  const forbiddenContent = ['system prompt', 'internal rules', 'config.json', 'api key', 'ignore previous instructions'];
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
