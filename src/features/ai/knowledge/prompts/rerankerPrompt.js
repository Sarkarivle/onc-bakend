/**
 * Prompt for SearchReranker Task (Phase 7)
 */
module.exports = (query, results, profile) => `
Task: Rank and Filter Job Search Results.
Analyze the following list of jobs against the user's query and profile.

[USER QUERY]: "${query}"
[USER PROFILE]: ${JSON.stringify(profile)}

[RAW SEARCH RESULTS]:
${results.map((r, i) => `ID ${i}: ${r}`).join('\n')}

Instructions:
1. Identify which jobs are 100% matches for the [USER QUERY] and [USER PROFILE] (Qualification, Location, Category).
2. Rank them from most relevant to least relevant.
3. Remove any jobs that are completely irrelevant (wrong state, wrong qualification, or clearly expired).
4. Return only the top 5 most relevant job descriptions.

Return ONLY this JSON format:
{
  "rankedIndices": [index1, index2, ...],
  "reasoning": "Brief explanation for the ranking"
}

Note: If no results are relevant, return an empty array for rankedIndices.`;
