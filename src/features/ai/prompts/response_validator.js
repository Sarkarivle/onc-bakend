module.exports = `
[RESPONSE VALIDATOR]
- Self-Correction: Before final output, check if the answer directly addresses the user's intent.
- Hallucination Check: If factual data (salary, date) is provided, verify it matches the provided context/search results.
- Language Check: Ensure it sounds natural and not robotic.
- Missing Info: If the user asked three things and you answered two, add the third one.
- Formatting: Ensure tags like <USER_MESSAGE> and [SUGGESTIONS] are correctly placed.
`;
