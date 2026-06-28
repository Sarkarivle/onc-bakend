/**
 * EmbeddingIntentMatcher Module
 * Responsibility: Hybrid semantic matching. Uses deterministic local similarity as
 * an embedding fallback when no embedding service is configured.
 */
const IntentExampleRegistry = require('./intentExampleRegistry');
const IndianLanguageNormalizer = require('./indianLanguageNormalizer');

class EmbeddingIntentMatcher {
    static match(query) {
        const q = this.normalize(query);
        const registry = IntentExampleRegistry.getRegistry();
        const results = [];

        for (const [intent, examples] of Object.entries(registry)) {
            let best = { score: 0, example: null };

            for (const example of examples) {
                const normalizedExample = this.normalize(example);
                const score = this.calculateSimilarity(q, normalizedExample, intent);
                if (score > best.score) {
                    best = { score, example };
                }
            }

            results.push({
                intent,
                score: Number(Math.min(1, best.score).toFixed(3)),
                example: best.example,
                domainIntent: IntentExampleRegistry.getMetadata(intent).domainIntent
            });
        }

        return results.sort((a, b) => b.score - a.score);
    }

    static normalize(text = "") {
        return text
            .replace(/^(.+)$/, IndianLanguageNormalizer.normalize)
            .toLowerCase()
            .replace(/[?؟!.,"']/g, ' ')
            .replace(/\b(naukri|rojgar|kaam|job|jobs|vacancy|bharti|form)\b/g, ' job ')
            .replace(/\b(paisa|paise|earning|income|kamai)\b/g, ' earning ')
            .replace(/\b(apply|application|registration|awedan|aavedan)\b/g, ' apply ')
            .replace(/\b(fees|fee|shulk|charge)\b/g, ' fee ')
            .replace(/\b(umar|umr|aayu)\b/g, ' age ')
            .replace(/\b(vetan|pay|payscale)\b/g, ' salary ')
            .replace(/\b(yogyata|qualification|education)\b/g, ' eligibility ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static calculateSimilarity(s1, s2, intent) {
        if (!s1 || !s2) return 0;
        if (s1 === s2) return 1;

        const tokenScore = this.tokenSimilarity(s1, s2);
        const charScore = this.charNgramSimilarity(s1, s2);
        const containsScore = (s1.includes(s2) || s2.includes(s1)) ? 0.72 : 0;
        const semanticBoost = this.semanticBoost(s1, intent);

        return Math.max(tokenScore, charScore, containsScore, semanticBoost);
    }

    static tokenSimilarity(s1, s2) {
        const words1 = new Set(s1.split(/\s+/).filter(Boolean));
        const words2 = new Set(s2.split(/\s+/).filter(Boolean));
        const intersection = [...words1].filter(x => words2.has(x)).length;
        const union = new Set([...words1, ...words2]).size || 1;
        const jaccard = intersection / union;
        const coverage = intersection / Math.min(words1.size || 1, words2.size || 1);
        return Math.max(jaccard, coverage * 0.78);
    }

    static charNgramSimilarity(s1, s2) {
        const grams1 = this.ngrams(s1, 3);
        const grams2 = this.ngrams(s2, 3);
        if (grams1.size === 0 || grams2.size === 0) return 0;
        const intersection = [...grams1].filter(x => grams2.has(x)).length;
        const union = new Set([...grams1, ...grams2]).size;
        return (intersection / union) * 0.85;
    }

    static ngrams(text, size) {
        const normalized = ` ${text} `;
        const grams = new Set();
        for (let i = 0; i <= normalized.length - size; i += 1) {
            grams.add(normalized.slice(i, i + size));
        }
        return grams;
    }

    static semanticBoost(query, intent) {
        const has = (regex) => regex.test(query);

        const boosts = {
            JOB_QUERY: [
                [/(job|sarkari|government|vacancy|bharti|form|rojgar|kaam)/, 0.78],
                [/(mere liye|qualification pe|chance|opening|apply wali)/, 0.74],
                [/(job|kaam).*(hai kya|chahiye|batao|option)/, 0.86]
            ],
            CAREER_GUIDANCE: [
                [/(career|future|settle|roadmap|skill|course)/, 0.8],
                [/(earning|income|kamai).*(kya karu|kaise|option)/, 0.82],
                [/(12th|graduation|graduate).*(baad|after|kya karu)/, 0.86]
            ],
            APPLICATION_HELP: [
                [/(form|apply|registration).*(bhar|kaise|process|steps|submit)/, 0.88],
                [/(application|form).*(open|nikla|aaya|aya)/, 0.84],
                [/application job open/, 0.84]
            ],
            MORE_RESULTS: [
                [/^(aur|next|more|dusra|baaki|sirf|1 hi|bas itna)/, 0.86]
            ],
            FIELD_DETAILS: [
                [/^(fee|age|salary|eligibility|last date|link|apply|documents|selection|syllabus)\??$/, 0.92]
            ],
            EXPLAIN_LAST_FAILURE: [
                [/(kyu|why).*(nahi|na).*(mila|mili|aaya|dikha)/, 0.9],
                [/(reason|dikkat|problem).*(bata|kya)/, 0.78]
            ],
            RESUME: [
                [/(resume|cv|biodata|portfolio)/, 0.92]
            ],
            SCHOLARSHIP: [
                [/(scholarship|chatravriti|wazifa|fee support|student yojana)/, 0.92]
            ],
            RESULT_ADMIT_CARD: [
                [/(result|admit card|answer key|cutoff|merit|score card)/, 0.9]
            ]
        };

        for (const [regex, score] of boosts[intent] || []) {
            if (has(regex)) return score;
        }

        return 0;
    }
}

module.exports = EmbeddingIntentMatcher;
