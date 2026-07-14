const TRUSTED_GOV_DOMAINS = [
    'gov.in',
    'nic.in',
    'ssc.gov.in',
    'upsc.gov.in',
    'ncs.gov.in',
    'scholarships.gov.in'
];

function normalizeUrl(url) {
    const value = String(url || '').trim();
    if (!value || value === 'N/A' || value === 'In Details') return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(value)) return `https://${value}`;
    return '';
}

function domainOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch (_) {
        return '';
    }
}

function isTrustedOfficial(url) {
    const domain = domainOf(url);
    if (!domain) return false;
    return TRUSTED_GOV_DOMAINS.some(trusted => domain === trusted || domain.endsWith(`.${trusted}`));
}

function confidenceForSource(url, fallback = 0.55) {
    if (!url) return fallback;
    return isTrustedOfficial(url) ? 0.92 : 0.72;
}

function fromJob(job = {}) {
    const sourceUrl = normalizeUrl(
        job.officialLinks?.notification ||
        job.officialLinks?.apply ||
        job.applyLink ||
        job.sourceUrl ||
        job.link
    );

    return {
        title: job.title || job.organization || 'Job source',
        source: sourceUrl || 'Internal job database',
        sourceUrl,
        verified: Boolean(sourceUrl && isTrustedOfficial(sourceUrl)),
        confidence: confidenceForSource(sourceUrl, sourceUrl ? 0.72 : 0.62),
        lastUpdated: job.updatedAt || job.createdAt || null,
        note: sourceUrl ? 'Official link should be opened before applying.' : 'No official public link stored for this record.'
    };
}

function fromSearchResult(result = {}, sourceName = 'Web search') {
    const sourceUrl = normalizeUrl(result.link || result.url);
    return {
        title: result.title || sourceName,
        source: sourceName,
        sourceUrl,
        verified: Boolean(sourceUrl && isTrustedOfficial(sourceUrl)),
        confidence: confidenceForSource(sourceUrl, 0.6),
        lastUpdated: result.date || null,
        note: result.snippet ? String(result.snippet).slice(0, 220) : ''
    };
}

function summarize(evidence = []) {
    const items = (Array.isArray(evidence) ? evidence : []).filter(Boolean);
    if (items.length === 0) {
        return {
            verified: false,
            confidence: 0,
            sources: [],
            warning: 'Verified official source is not available yet.'
        };
    }

    const confidence = Math.max(...items.map(item => Number(item.confidence || 0)));
    return {
        verified: items.some(item => item.verified),
        confidence,
        sources: items.slice(0, 5),
        warning: items.some(item => item.verified) ? null : 'No government/official source found in the retrieved evidence.'
    };
}

function footer(evidence = []) {
    const summary = summarize(evidence);
    if (summary.sources.length === 0) {
        return '\n\n🔎 **Verification:** Official source abhi available nahi hai. Apply/fee/date jaisi cheez final karne se pehle official notification check karo.';
    }

    const lines = summary.sources
        .map((item, index) => {
            const label = item.sourceUrl ? `[${item.title || `Source ${index + 1}`}](${item.sourceUrl})` : (item.title || item.source || `Source ${index + 1}`);
            const mark = item.verified ? 'official' : 'supporting';
            return `${index + 1}. ${label} - ${mark}, confidence ${Math.round((item.confidence || 0) * 100)}%`;
        })
        .join('\n');

    const warning = summary.warning ? `\n\n⚠️ ${summary.warning}` : '';
    return `\n\n🔎 **Verification Sources:**\n${lines}${warning}`;
}

module.exports = {
    normalizeUrl,
    isTrustedOfficial,
    confidenceForSource,
    fromJob,
    fromSearchResult,
    summarize,
    footer
};
