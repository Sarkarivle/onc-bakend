/**
 * Prompt for MemoryManager Task (Multi-turn Neural Memory)
 */
module.exports = (userMsg, aiMsg, currentInsights) => `
Task: Extract User Facts and Update Memory.
Analyze the latest turn of conversation and update the user's permanent profile.

[CURRENT MEMORY]:
${JSON.stringify(currentInsights)}

[LATEST TURN]:
User: "${userMsg}"
Assistant: "${aiMsg}"

Instructions:
1. Identify any NEW facts explicitly mentioned by the USER only (Qualification, Location, Category, DOB, Age, specific Interests).
2. Never extract profile facts from the assistant response. The assistant may be wrong.
3. If the user denies a fact (example: "main 12th pass nahi hu"), remove that fact from memory instead of storing it.
4. If a fact was already known but the user changed it, update it.
5. Merge new facts with [CURRENT MEMORY].
6. Provide a very short 1-sentence summary of the conversation so far to keep context fresh.

Return ONLY this JSON format:
{
  "updatedInsights": {
    "qualification": "string",
    "location": "string",
    "category": "string",
    "interests": ["interest1", "interest2"],
    "age": number,
    "dob": "string"
  },
  "turnSummary": "Short summary of this exchange"
}

Note: If no new info is found, return the [CURRENT MEMORY] as updatedInsights.`;
