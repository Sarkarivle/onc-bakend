/**
 * SafetyGuard Module (Minimalist Architecture)
 * Responsibility: Emergency responses and standard response shaping.
 */

const SAFE_RESPONSES = {
  EMPTY_INPUT: "Aap apna sawal clear puch dijiye. Jaise: latest job, age limit, fees, last date ya career guidance.",
  INJECTION_ATTEMPT: "Maaf kijiye, main internal/private system details share nahi kar sakta.",
  FAKE_JOB: "Maaf kijiye, mujhe abhi iski verified official jankari available nahi hai.",
  UNSAFE_OUTPUT: "Maaf kijiye, main is tarah ki jankari nahi de sakta.",
  GENERIC_FALLBACK: "Maaf kijiye, मुझे अभी इसकी verified जानकारी नहीं मिली है। आप official notification check कर सकते हैं।",
  GREETING: "Namaste! Main Jobo AI hoon. Main jobs, career, resume, scholarship aur exam details me madad kar sakta hoon.",
  MALICIOUS_INTENT: "Security alert: Request blocked due to unsafe patterns.",
  GIBBERISH: "Kripya sahi se sawal likhein taaki main aapki madad kar sakun."
};

function normalizeRequest(body) {
  if (!body || typeof body !== 'object') return "";
  const message = body.question || body.message || body.userMessage || body.query || body.input || body.prompt || body.text || "";
  return String(message).replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim();
}

function shapeResponse(finalText, existingExtras = {}) {
  return { success: true, message: finalText, answer: finalText, ...existingExtras };
}

module.exports = {
  normalizeRequest,
  shapeResponse,
  SAFE_RESPONSES
};
