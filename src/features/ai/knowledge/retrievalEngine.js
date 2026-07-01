/**
 * RetrievalEngine Module (Architectural Version 9.0 - Standard Hybrid Search)
 * Responsibility: Executing Optimized Search (Text + Regex + Metadata) for Non-Atlas Environments.
 */
const Job = require('../../jobs/jobModel');
const SearchReranker = require('./searchReranker');
const LLMProvider = require('../generation/llmProvider');

class RetrievalEngine {
    /**
     * Entry Point: Optimized Standard Search
     */
    static async searchJobs(userQuery, profile = {}, plan = {}) {
        const startTime = Date.now();
        const telemetry = { latency: {}, stats: {} };

        try {
            // 1. QUERY UNDERSTANDING & EXPANSION
            const expansion = await this._expandQuery(userQuery);
            telemetry.expandedQuery = expansion;

            // 2. OPTIMIZED SEARCH (Standard Mongo compatible)
            let candidates = await this._standardSearch(expansion, profile);
            telemetry.stats.candidatesFound = candidates.length;

            if (candidates.length === 0) return { jobs: "", documents: [], confidence: 0 };

            // 3. NEURAL RERANKING
            const rankedResults = await SearchReranker.rank(userQuery, candidates, profile);
            telemetry.stats.rankedCount = rankedResults.length;

            // 4. QUALITY FILTERING
            const finalResults = rankedResults.filter(r => r.score > 0.3);

            telemetry.latency.total = Date.now() - startTime;
            this._logTelemetry(telemetry);

            return {
                count: finalResults.length,
                documents: finalResults,
                jobs: finalResults.map(j => this._formatJob(j)).join("\n"),
                confidence: finalResults.length > 0 ? finalResults[0].score : 0
            };

        } catch (error) {
            console.error("❌ Retrieval Error:", error.message);
            return { count: 0, jobs: "", documents: [], confidence: 0 };
        }
    }

    /**
     * Semantic Query Expansion for better Keyword matching
     */
    static async _expandQuery(query) {
        try {
            const prompt = `
Task: Expand user career query for Search.
Query: "${query}"
Output JSON: { "keywords": ["word1", "word2"], "filters": { "location": "string" } }
`;
            const res = await LLMProvider.generateLogic(prompt);
            return res || { keywords: query.split(' '), filters: {} };
        } catch (e) {
            return { keywords: query.split(' '), filters: {} };
        }
    }

    /**
     * Core Search Logic: Text Index (if available) + Regex Fallback
     */
    static async _standardSearch(expansion, profile) {
        const { keywords } = expansion;
        const searchRegex = new RegExp(keywords.join('|'), 'i');

        const criteria = {
            isActive: true,
            $or: [
                { title: { $regex: searchRegex } },
                { organization: { $regex: searchRegex } },
                { "eligibility.education": { $regex: searchRegex } },
                { "eligibility.skills": { $regex: searchRegex } }
            ]
        };

        // Smart Filtering based on Profile
        if (profile.qualification) {
            // Soft match qualification
            const qualRegex = new RegExp(profile.qualification.split(' ')[0], 'i');
            criteria["eligibility.education"] = { $regex: qualRegex };
        }

        try {
            // Try Text Search first if index exists
            return await Job.find({
                isActive: true,
                $text: { $search: keywords.join(' ') }
            })
            .limit(25).lean();
        } catch (e) {
            // Fallback to Regex Search
            return await Job.find(criteria).limit(25).lean();
        }
    }

    static _mergeCandidates(vec, key) {
        const map = new Map();
        [...vec, ...key].forEach((j, i) => {
            if (!map.has(j._id.toString())) {
                map.set(j._id.toString(), { ...j, score: 1 });
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
