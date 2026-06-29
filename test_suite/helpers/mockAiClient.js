/**
 * Mock AI Client for Test Suites
 * Provides fast, deterministic, rule-based responses for testing purposes.
 * This completely avoids hitting real AI services, databases, or other backends.
 */

async function processMessage(message, context = {}) {
  const q = String(message || "").toLowerCase();

  if (/^(hi|hello|namaste|hey|hii)/i.test(q)) {
    return { message: "Namaste! Main Jobo AI assistant hoon. Kaise madad kar sakta hoon?" };
  }

  if (q.includes("tum kaun ho") || q.includes("who are you")) {
    return { message: "Main Jobo AI assistant hoon, jo jobs, career, result, admit card aur resume se judi madad karta hai." };
  }

  if (q.includes("doctor") || q.includes("mbbs") || q.includes("neet") || q.includes("medical")) {
    return { message: "Doctor banne ke liye 12th Biology ke baad NEET exam qualify karke MBBS course karna hota hai. MBBS ke baad internship aur registration ke baad doctor ke roop me career start hota hai." };
  }

  if (q.includes("aur batao") || q.includes("more") || q.includes("next")) {
    return { message: "Kripya batayein kiske baare me aur jankari chahiye? Aap kya janna chahte hain?" };
  }

  if (q.includes("ctet") || q.includes("jhtet") || q.includes("tet")) {
    return { message: "Ye eligibility test hai, direct vacancy nahi. Iske liye official notification check karke eligibility, syllabus aur dates verify karni chahiye." };
  }

  if (
    q.includes("fake") ||
    q.includes("direct joining") ||
    q.includes("without exam") ||
    q.includes("nasa clerk") ||
    q.includes("pm office peon")
  ) {
    return { message: "Is vacancy ki verified jankari available nahi hai. Main bina official notification ke vacancy, last date, fee, salary ya apply link confirm nahi kar sakta." };
  }

  if (
    q.includes("system prompt") ||
    q.includes("developer instruction") ||
    q.includes("resolvedintent") ||
    q.includes("api key") ||
    q.includes("database password") ||
    q.includes("internal json") ||
    q.includes("ignore previous")
  ) {
    return { message: "Main internal system, private configuration ya hidden instructions share nahi kar sakta. Aap job ya career se juda sawal pooch sakte hain." };
  }

  if (q.includes("latest job") || q.includes("sarkari job") || q.includes("railway") || q.includes("vacancy") || q.includes("bharti")) {
    return { message: "Verified job details ke liye official notification check karna zaroori hai. Bina verified source ke main last date, fee, vacancy ya apply link confirm nahi karunga." };
  }

  return { message: "Kripya apna sawal thoda clear batayein, main jobs, career, resume, scholarship, result aur admit card me madad kar sakta hoon." };
}

module.exports = { processMessage };