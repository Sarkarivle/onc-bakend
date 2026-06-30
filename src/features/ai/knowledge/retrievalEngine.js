/**
 * RetrievalEngine Module (Phase 3)
 * Responsibility: Executing Hybrid Search (Vector + Semantic) to find the best data.
 */
const Job = require('../../jobs/jobModel');
const VectorService = require('./vectorService');
const SearchReranker = require('./searchReranker');

class RetrievalEngine {
    /**
     * Finds jobs based on the refined query and user profile.
     */
    static async searchJobs(refinedQuery, profile = {}, plan = {}) {
        try {
            console.log(`🔎 Retrieval: Searching for "${refinedQuery}"`);

            // 1. Vector Search (Semantic Meaning)
            let results = await this._vectorSearch(refinedQuery);

            // 2. Hybrid Fallback (If vector results are low or empty)
            if (!results || results.length < 3) {
                const keywordResults = await this._semanticTextSearch(refinedQuery, profile);
                results = this._mergeResults(results, keywordResults);
            }

            // 3. Neural Reranking (Phase 7 Evolution)
            if (results.length > 1) {
                console.log(`🧠 Reranking ${results.length} candidates...`);
                results = await SearchReranker.rank(refinedQuery, results, profile);
            }

            return {
                count: results.length,
                jobs: results.length > 0 ? results.map(j => this._formatJob(j)).join("\n") : ""
            };
        } catch (error) {
            console.error("❌ Retrieval Engine Error:", error.message);
            return { count: 0, jobs: "" };
        }
    }

    /**
     * Step A: Pure Neural Search (Vector)
     */
    static async _vectorSearch(query) {
        const queryVector = await VectorService.generate(query);
        if (!queryVector) return [];

        try {
            return await Job.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "searchVector",
                        queryVector: queryVector,
                        numCandidates: 100,
                        limit: 10
                    }
                },
                { $match: { isActive: true } }
            ]);
        } catch (err) {
            console.warn("⚠️ Vector Index not ready, skipping vector search.");
            return [];
        }
    }

    /**
     * Step B: Semantic Text Search (Fallback)
     * Matches Phase 3: No manual keywords, uses AI-refined query.
     */
    static async _semanticTextSearch(query, profile) {
        // We use the refined query as a whole for regex matching across title/org/content
        const searchRegex = new RegExp(query.split(' ').filter(w => w.length > 3).join('|'), 'i');

        let criteria = {
            isActive: true,
            $or: [
                { title: searchRegex },
                { organization: searchRegex },
                { fullHtmlContent: searchRegex }
            ]
        };

        // Personalization Filter (If available)
        if (profile.qualification) {
            criteria['eligibility.education'] = { $regex: profile.qualification, $options: 'i' };
        }

        return await Job.find(criteria).sort({ createdAt: -1 }).limit(10);
    }

    static _mergeResults(vec, text) {
        const seen = new Set(vec.map(j => j._id.toString()));
        const merged = [...vec];
        text.forEach(j => {
            if (!seen.has(j._id.toString())) {
                merged.push(j);
                seen.add(j._id.toString());
            }
        });
        return merged.slice(0, 10);
    }

    static _formatJob(j) {
        return `- JOB: ${j.title || "N/A"} | Org: ${j.organization || "N/A"} | Vacancy: ${j.totalVacancy || "N/A"} | Last Date: ${j.importantDates?.applicationLastDate || "Check Official Site"}`;
    }
}

module.exports = RetrievalEngine;
