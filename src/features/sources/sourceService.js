const axios = require('axios');
const cheerio = require('cheerio');
const { createHash } = require('crypto');
const OfficialSource = require('./sourceModel');

class SourceService {
  static hash(text) {
    return createHash('sha256').update(String(text || '')).digest('hex');
  }

  static normalizeUrl(url) {
    const value = String(url || '').trim();
    if (!value) throw new Error('URL is required');
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  static domain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch (_) {
      return '';
    }
  }

  static extract(html) {
    const $ = cheerio.load(html || '');
    $('script, style, nav, footer, header, iframe, noscript').remove();
    const title = ($('title').first().text() || $('h1').first().text() || '').replace(/\s+/g, ' ').trim();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return {
      title: title.slice(0, 180),
      excerpt: text.slice(0, 500),
      text
    };
  }

  static async upsertSource(input, user = null) {
    const url = this.normalizeUrl(input.url);
    const update = {
      name: input.name || this.domain(url) || url,
      type: input.type || 'GENERAL',
      url,
      officialDomain: input.officialDomain || this.domain(url),
      isActive: input.isActive !== false,
      fetchIntervalHours: Number(input.fetchIntervalHours || 24),
      staleAfterHours: Number(input.staleAfterHours || 72)
    };
    if (user?._id) update.createdBy = user._id;

    return await OfficialSource.findOneAndUpdate(
      { url },
      update,
      { upsert: true, new: true, runValidators: true }
    );
  }

  static dueQuery(now = new Date()) {
    return {
      isActive: true,
      $or: [
        { lastFetchedAt: { $exists: false } },
        { lastFetchedAt: null },
        {
          $expr: {
            $lte: [
              '$lastFetchedAt',
              { $dateSubtract: { startDate: now, unit: 'hour', amount: '$fetchIntervalHours' } }
            ]
          }
        }
      ]
    };
  }

  static async fetchOne(source) {
    const started = Date.now();
    try {
      const response = await axios.get(source.url, {
        timeout: Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 10000),
        headers: { 'User-Agent': 'JoboAI-FreshnessBot/1.0 (+student-assistant)' },
        maxRedirects: 4
      });

      const extracted = this.extract(response.data);
      const nextHash = this.hash(extracted.text);
      const changed = source.contentHash && source.contentHash !== nextHash;
      const firstFetch = !source.contentHash;

      source.lastFetchedAt = new Date();
      source.lastHttpStatus = response.status;
      source.lastStatus = changed || firstFetch ? 'CHANGED' : 'UNCHANGED';
      source.lastError = '';
      source.contentHash = nextHash;
      source.title = extracted.title || source.name;
      source.excerpt = extracted.excerpt;
      if (changed || firstFetch) source.lastChangedAt = new Date();
      await source.save();

      return {
        id: source._id,
        name: source.name,
        url: source.url,
        status: source.lastStatus,
        changed: changed || firstFetch,
        httpStatus: response.status,
        durationMs: Date.now() - started
      };
    } catch (error) {
      source.lastFetchedAt = new Date();
      source.lastStatus = 'FAILED';
      source.lastError = error.message;
      source.lastHttpStatus = error.response?.status;
      await source.save();

      return {
        id: source._id,
        name: source.name,
        url: source.url,
        status: 'FAILED',
        changed: false,
        error: error.message,
        httpStatus: error.response?.status,
        durationMs: Date.now() - started
      };
    }
  }

  static async refreshDue({ limit = 20 } = {}) {
    const sources = await OfficialSource.find(this.dueQuery()).sort({ lastFetchedAt: 1 }).limit(limit);
    const results = [];
    for (const source of sources) {
      results.push(await this.fetchOne(source));
    }
    return {
      processed: results.length,
      changed: results.filter(r => r.changed).length,
      failed: results.filter(r => r.status === 'FAILED').length,
      results
    };
  }

  static async healthReport() {
    const now = Date.now();
    const sources = await OfficialSource.find({ isActive: true }).lean();
    const stale = sources.filter(source => {
      if (!source.lastFetchedAt) return true;
      const ageHours = (now - new Date(source.lastFetchedAt).getTime()) / (1000 * 60 * 60);
      return ageHours > Number(source.staleAfterHours || 72);
    });

    return {
      total: sources.length,
      stale: stale.length,
      failed: sources.filter(source => source.lastStatus === 'FAILED').length,
      neverFetched: sources.filter(source => source.lastStatus === 'NEVER_FETCHED').length,
      staleSources: stale.slice(0, 20).map(source => ({
        id: source._id,
        name: source.name,
        type: source.type,
        url: source.url,
        lastFetchedAt: source.lastFetchedAt,
        lastStatus: source.lastStatus
      }))
    };
  }
}

module.exports = SourceService;
