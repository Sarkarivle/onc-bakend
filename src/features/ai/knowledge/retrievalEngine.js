/**
 * RetrievalEngine Module (Architectural Version 8.0 - Hybrid Neural Retrieval)
 * Responsibility: Executing Hybrid Search (Vector + BM25 + Metadata) with Reranking.
 * Designed for enterprise-grade precision and minimal hallucination.
 */
const Job = require('../../jobs/jobModel');
const VectorService = require('./vectorService');
const SearchReranker = require('./searchReranker');
const LLMProvider = require('../generation/llmProvider');

class RetrievalEngine {
    /**
     * Entry Point: Optimized Hybrid Search
     */
    static async searchJobs(userQuery, profile = {}, plan = {}) {
        const startTime = Date.now();
        const telemetry = { latency: {}, stats: {} };

        try {
            // 1. QUERY UNDERSTANDING & EXPANSION
            // We use the refinedQuery from the UCC, but expand it for better coverage
            const expansion = await this._expandQuery(userQuery);
            telemetry.expandedQuery = expansion;

            // 2. PARALLEL RETRIEVAL (Phase 1: Candidate Generation)
            const [vectorCandidates, keywordCandidates] = await Promise.all([
                this._vectorSearch(expansion.semanticQuery, profile),
                this._keywordSearch(expansion.keywords, profile)
            ]);

            // 3. MERGE & DEDUPLICATE
            let candidates = this._mergeCandidates(vectorCandidates, keywordCandidates);
            telemetry.stats.candidatesFound = candidates.length;

            if (candidates.length === 0) return { jobs: "", documents: [], confidence: 0 };

            // 4. NEURAL RERANKING (Phase 2: Precision Ranking)
            // Considering freshness, popularity, and profile compatibility
            const rankedResults = await SearchReranker.rank(userQuery, candidates, profile);
            telemetry.stats.rankedCount = rankedResults.length;

            // 5. HALLUCINATION CHECK & SCORING
            const finalResults = rankedResults.filter(r => r.score > 0.4); // Threshold for quality

            // 6. TELEMETRY & LOGGING
            telemetry.latency.total = Date.now() - startTime;
            this._logTelemetry(telemetry);

            return {
                count: finalResults.length,
                documents: finalResults,
                jobs: finalResults.map(j => this._formatJob(j)).join("\n"),
                confidence: finalResults.length > 0 ? finalResults[0].score : 0
            };

        } catch (error) {
            console.error("❌ Hybrid Retrieval Error:", error.message);
            return { count: 0, jobs: "", documents: [], confidence: 0 };
        }
    }

    /**
     * Step 1: Semantic Query Expansion
     */
    static async _expandQuery(query) {
        const prompt = `
Task: Expand user career query for Hybrid Search.
Query: "${query}"
Output JSON: { "semanticQuery": "sentence with synonyms", "keywords": ["word1", "word2"], "filters": { "salary": bool, "location": "string" } }
`;
        const res = await LLMProvider.generateLogic(prompt);
        return res || { semanticQuery: query, keywords: query.split(' '), filters: {} };
    }

    /**
     * Step 2A: Vector Search (Semantic)
     */
    static async _vectorSearch(query, profile) {
        const queryVector = await VectorService.generate(query);
        if (!queryVector) return [];

        const pipeline = [
            {
                $vectorSearch: {
                    index: "vector_index",
                    path: "searchVector",
                    queryVector: queryVector,
                    numCandidates: 100,
                    limit: 20
                }
            },
            { $match: { isActive: true } }
        ];

        // Metadata Filter: Qualification matching at DB level
        if (profile.qualification) {
            pipeline.push({
                $match: { "eligibility.education": { $regex: profile.qualification, $options: 'i' } }
            });
        }

        return await Job.aggregate(pipeline);
    }

    /**
     * Step 2B: Keyword Search (BM25 Equivalent)
     */
    static async _keywordSearch(keywords, profile) {
        const searchString = keywords.join(' ');
        const criteria = {
            isActive: true,
            $text: { $search: searchString }
        };

        if (profile.qualification) {
            criteria['eligibility.education'] = { $regex: profile.qualification, $options: 'i' };
        }

        return await Job.find(criteria)
            .sort({ score: { $meta: "textScore" } })
            .limit(20)
            .lean();
    }

    /**
     * Step 3: Candidate Merging (Reciprocal Rank Fusion logic)
     */
    static _mergeCandidates(vec, key) {
        const map = new Map();
        vec.forEach((j, i) => map.set(j._id.toString(), { ...j, score: 1 / (i + 1) }));
        key.forEach((j, i) => {
            const id = j._id.toString();
            const existing = map.get(id);
            const keyScore = 1 / (i + 1);
            if (existing) {
                existing.score += keyScore;
            } else {
                map.set(id, { ...j, score: keyScore });
            }
        });
        return Array.from(map.values());
    }

    static _formatJob(j) {
        return `- [${j.title}] | Org: ${j.organization} | Last Date: ${j.importantDates?.applicationLastDate || "Verified Soon"} | Link: ${j.officialLinks?.apply || "In Details"}`;
    }

    static _logTelemetry(data) {
        if (process.env.DEBUG_RETRIEVAL === 'true') {
            console.log('[RETRIEVAL TELEMETRY]', JSON.stringify(data, null, 2));
        }
    }
}

module.exports = RetrievalEngine;
