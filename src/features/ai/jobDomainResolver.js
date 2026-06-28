/**
 * JobDomainResolver
 * Resolves government job sub-domains without changing the canonical JOB_QUERY intent.
 */
class JobDomainResolver {
    static resolve(text = "") {
        const q = String(text).toLowerCase();
        const matchers = [
            { domain: 'RAILWAY_JOB', graphDomain: 'RAILWAY_JOB', regex: /\b(railway|rrb|group d|rpf|alp|ntpc)\b/ },
            { domain: 'BANK_JOB', graphDomain: 'BANK_JOB', regex: /\b(sbi|ibps|bank|po|clerk|rbi)\b/ },
            { domain: 'POLICE_JOB', graphDomain: 'POLICE_JOB', regex: /\b(police|constable|si|daroga|home guard|delhi police)\b/ },
            { domain: 'DEFENCE_JOB', graphDomain: 'DEFENCE_JOB', regex: /\b(army|navy|air force|agniveer|cisf|bsf|crpf|itbp|ssb|defence)\b/ },
            { domain: 'TEACHING_JOB', graphDomain: 'TEACHING_JOB', regex: /\b(teacher|tgt|pgt|prt|ctet|tet|teaching)\b/ },
            { domain: 'HEALTH_JOB', graphDomain: 'HEALTH_JOB', regex: /\b(nursing|nurse|anm|gnm|asha|anganwadi|health worker|staff nurse)\b/ }
        ];

        return matchers.find(item => item.regex.test(q)) || {
            domain: 'GOVT_JOB',
            graphDomain: 'GOVERNMENT_JOBS',
            regex: null
        };
    }
}

module.exports = JobDomainResolver;
