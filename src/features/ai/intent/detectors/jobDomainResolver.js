/**
 * JobDomainResolver Module
 * Responsibility: Maps specific job keywords to their canonical domain.
 */
class JobDomainResolver {
    static resolve(query = "") {
        const q = query.toLowerCase();

        const domains = [
            { id: 'RAILWAY_JOB', regex: /\b(railway|rrb|rpf|alp|ntpc|group d|tce|loco pilot)\b/i },
            { id: 'BANK_JOB', regex: /\b(bank|ibps|sbi|rbi|clerk|po|so|nabard|rrb bank)\b/i },
            { id: 'POLICE_JOB', regex: /\b(police|constable|daroga|si|sub inspector|home guard|cops|sipahi|upp|bssc)\b/i },
            { id: 'DEFENCE_JOB', regex: /\b(army|navy|air force|agniveer|defence|bsf|crpf|cisf|itbp|ssb|nda|cds)\b/i },
            { id: 'TEACHING_JOB', regex: /\b(teacher|teaching|prt|tgt|pgt|lecturer|professor|ctet|uptet|kvs|nvs)\b/i },
            { id: 'HEALTH_JOB', regex: /\b(anganwadi|asha|anm|staff nurse|nurse|nursing|medical|health worker|gnm)\b/i },
            { id: 'EXAM', regex: /\b(ssc|upsc|bpsc|mppsc|rpsc|uppsc|hssc|uksssc|dsssb|entrance)\b/i }
        ];

        for (const domain of domains) {
            if (domain.regex.test(q)) {
                return { domain: domain.id, confidence: 0.9 };
            }
        }

        return { domain: 'GOVT_JOB', confidence: 0.5 };
    }
}

module.exports = JobDomainResolver;
