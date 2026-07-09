/**
 * RetrievalEngine Module (Architectural Version 9.0 - Standard Hybrid Search)
 * Responsibility: Executing Optimized Search (Text + Regex + Metadata) for Non-Atlas Environments.
 */
const Job = require('../../jobs/jobModel');
const SearchReranker = require('./searchReranker');
const LLMProvider = require('../generation/core_engine/llmProvider');
const EligibilityEngine = require('../../eligibility/EligibilityEngine');

class RetrievalEngine {
    /**
     * Entry Point: Optimized Standard Search
     */
    static async searchJobs(userQuery, profile = {}, plan = {}) {
        const startTime = Date.now();
        const telemetry = { latency: {}, stats: {} };

        try {
            if (Job.db?.readyState !== 1) {
                return { count: 0, jobs: "", documents: [], confidence: 0 };
            }

            // Enable expansion for conversational queries
            const skipLlmExpansion = plan.searchStrategy?.skipLlmExpansion === true;
            const skipLlmRerank = plan.searchStrategy?.skipLlmRerank === true;

            const expansion = skipLlmExpansion
                ? this._basicExpansion(userQuery)
                : await this._expandQuery(userQuery);

            // 2. OPTIMIZED SEARCH
            let candidates = await this._standardSearch(expansion, profile);

            // FALLBACK: If no specific jobs found, fetch the most recent active jobs
            if (candidates.length === 0) {
                console.log("🔍 No keyword match. Fetching latest jobs as fallback...");
                candidates = await Job.find({ isActive: true }).sort({ createdAt: -1 }).limit(5).lean();
            }

            telemetry.stats.candidatesFound = candidates.length;
            if (candidates.length === 0) return { jobs: "", documents: [], confidence: 0 };

            // 3. NEURAL RERANKING
            const rankedResults = skipLlmRerank
                ? this._staticRank(candidates)
                : await SearchReranker.rank(userQuery, candidates, profile);
            telemetry.stats.rankedCount = rankedResults.length;

            // 4. ELIGIBILITY VERIFICATION (Step 3: Integrate EligibilityEngine)
            const verifiedResults = [];
            for (const candidate of rankedResults) {
                try {
                    const report = await EligibilityEngine.evaluate(profile, candidate, { skipLLM: true });
                    if (report.status === 'ELIGIBLE') {
                        verifiedResults.push(candidate);
                    } else {
                        console.log(`🚫 Filtered Ineligible Job: ${candidate.title} | Reason: ${report.failed_rules?.[0]?.message || 'Unknown'}`);
                    }
                } catch (e) {
                    console.error(`Eligibility error for ${candidate.title}:`, e.message);
                    verifiedResults.push(candidate); // Fallback
                }
            }

            // 5. QUALITY FILTERING
            const finalResults = verifiedResults.filter(r => r.score > 0.3);

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
        // FAST PATH: Skip LLM for simple queries (1-2 words)
        const words = query.trim().split(/\s+/);
        if (words.length <= 2) {
            return { keywords: words, filters: {} };
        }

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

    static _basicExpansion(query) {
        return {
            keywords: this._extractKeywords(query),
            filters: {}
        };
    }

    /**
     * Core Search Logic: Text Index (if available) + Regex Fallback
     */
    static async _standardSearch(expansion, profile) {
        const keywords = (expansion.keywords || []).map(k => String(k || "").trim()).filter(Boolean);
        const escapedKeywords = keywords.map(k => this._escapeRegex(k)).filter(Boolean);
        const searchRegex = escapedKeywords.length > 0 ? new RegExp(escapedKeywords.join('|'), 'i') : null;

        const criteria = { isActive: true };

        // --- NATIVE PRE-FILTERING (GENDER) ---
        const gender = (profile.gender || '').toLowerCase();
        if (gender === 'male' || gender === 'm') {
            criteria.title = { $not: /female only|only for women|mahila special|women only|anganwadi/i };
        } else if (gender === 'female' || gender === 'f') {
            criteria.title = { $not: /male only|only for men|men only/i };
        }

        // --- NATIVE PRE-FILTERING (EDUCATION) ---
        if (profile.qualification) {
            const edu = profile.qualification.toLowerCase();
            if (edu.includes('10th') || edu.includes('ssc')) {
                criteria['eligibility.education'] = { $regex: /10th|8th|high school/i };
            } else if (edu.includes('12th') || edu.includes('hsc') || edu.includes('inter')) {
                criteria['eligibility.education'] = { $regex: /12th|10th|8th|hsc|inter|high school/i };
            } else if (edu.includes('graduate') || edu.includes('degree')) {
                // Graduates can see most things, but we still prefer relevance
                criteria['eligibility.education'] = { $regex: /graduate|degree|12th|10th/i };
            }
        }

        if (searchRegex) {
            const searchClause = {
                $or: [
                    { title: { $regex: searchRegex } },
                    { organization: { $regex: searchRegex } },
                    { "eligibility.education": { $regex: searchRegex } },
                    { "tags": { $in: keywords } }
                ]
            };

            if (criteria.title || criteria['eligibility.education']) {
                // If we have filters, use $and to combine with $or
                const filters = [];
                if (criteria.title) {
                    filters.push({ title: criteria.title });
                    delete criteria.title;
                }
                if (criteria['eligibility.education']) {
                    filters.push({ 'eligibility.education': criteria['eligibility.education'] });
                    delete criteria['eligibility.education'];
                }
                criteria.$and = [searchClause, ...filters];
            } else {
                criteria.$or = searchClause.$or;
            }
        }

        try {
            // Try Text Search first if index exists
            const textResults = await Job.find({
                isActive: true,
                $text: { $search: keywords.join(' ') }
            })
            .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
            .select({ score: { $meta: 'textScore' } })
            .limit(25).lean();

            if (textResults.length > 0) return textResults;
        } catch (e) {
            // Text index may not exist in old deployments. Keep the legacy fallback below.
        }

        if (!searchRegex) return [];

        // Legacy fallback, now escaped/capped so user input cannot create unsafe regex.
        return await Job.find(criteria).sort({ createdAt: -1 }).limit(25).lean();
    }

    static _extractKeywords(query) {
        const stopWords = new Set(['mujhe', 'batao', 'please', 'bhai', 'yaar', 'ke', 'ki', 'ka', 'hai', 'h', 'mein', 'me', 'aur', 'latest']);
        const tokens = String(query || "")
            .toLowerCase()
            .split(/[^a-z0-9]+/i)
            .map(t => t.trim())
            .filter(t => t.length > 1 && !stopWords.has(t));
        return tokens.length > 0 ? tokens.slice(0, 8) : ['latest', 'jobs'];
    }

    static _escapeRegex(value) {
        return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    static _staticRank(results) {
        return (results || [])
            .map(job => {
                const textScore = typeof job.score === 'number' ? job.score : 0;
                const createdAt = new Date(job.createdAt || Date.now());
                const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
                const freshnessBoost = Math.max(0, (30 - daysOld) / 30) * 0.2;
                return { ...job, score: Math.max(textScore, 0.6) + freshnessBoost };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
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
