const AiAdviceFeedback = require('./models/AiAdviceFeedback');
const AiAdviceLog = require('./models/AiAdviceLog');

// Admin-only endpoints for the weekly "why did users downvote this" triage loop.
// Not for end users - exposes other users' profile snapshots (age/height/qualification).

const listFeedback = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.rating && ['up', 'down'].includes(req.query.rating)) filter.rating = req.query.rating;
    if (req.query.reason) filter.reason = req.query.reason;

    const [entries, total] = await Promise.all([
      AiAdviceFeedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('adviceLogId')
        .populate('userId', 'name phone')
        .lean(),
      AiAdviceFeedback.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      entries,
    });
  } catch (err) {
    console.error('Advice Review List Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

const STATS_DEFAULT_WINDOW_DAYS = 90;

const getStats = async (req, res) => {
  try {
    // Bounded by a recent window (default 90d, override with ?days=) so this
    // stays a fast indexed range scan instead of a full-collection join as
    // feedback volume grows into the millions. total_advice_generated below
    // is the one intentionally-unbounded lifetime counter.
    const days = parseFloat(req.query.days) || STATS_DEFAULT_WINDOW_DAYS;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateMatch = { $match: { createdAt: { $gte: since } } };

    const [ratingBreakdown, reasonBreakdown, promptVersionBreakdown, totalLogs] = await Promise.all([
      AiAdviceFeedback.aggregate([dateMatch, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
      AiAdviceFeedback.aggregate([
        { $match: { createdAt: { $gte: since }, reason: { $exists: true, $ne: null } } },
        { $group: { _id: '$reason', count: { $sum: 1 } } },
      ]),
      AiAdviceFeedback.aggregate([
        dateMatch,
        { $lookup: { from: 'aiadvicelogs', localField: 'adviceLogId', foreignField: '_id', as: 'log' } },
        { $unwind: '$log' },
        { $group: { _id: { promptVersion: '$log.promptVersion', rating: '$rating' }, count: { $sum: 1 } } },
      ]),
      AiAdviceLog.countDocuments(),
    ]);

    const up = ratingBreakdown.find(r => r._id === 'up')?.count || 0;
    const down = ratingBreakdown.find(r => r._id === 'down')?.count || 0;
    const totalRated = up + down;

    res.status(200).json({
      status: 'success',
      window_days: days,
      total_advice_generated: totalLogs,
      total_rated: totalRated,
      upvotes: up,
      downvotes: down,
      downvote_rate: totalRated > 0 ? +(down / totalRated * 100).toFixed(1) : 0,
      reason_breakdown: reasonBreakdown,
      by_prompt_version: promptVersionBreakdown,
    });
  } catch (err) {
    console.error('Advice Review Stats Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_THRESHOLD_PCT = 15;

// Recent-window downvote rate vs. a threshold. No push - poll this
// (e.g. from an uptime checker, or just visit it weekly) to see if quality dropped.
const checkAlert = async (req, res) => {
  try {
    const windowDays = parseFloat(req.query.windowDays) || DEFAULT_WINDOW_DAYS;
    const thresholdPct = parseFloat(req.query.threshold) || DEFAULT_THRESHOLD_PCT;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const ratingBreakdown = await AiAdviceFeedback.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);

    const up = ratingBreakdown.find(r => r._id === 'up')?.count || 0;
    const down = ratingBreakdown.find(r => r._id === 'down')?.count || 0;
    const totalRated = up + down;
    const downvoteRate = totalRated > 0 ? +(down / totalRated * 100).toFixed(1) : 0;
    const alertTriggered = totalRated > 0 && downvoteRate >= thresholdPct;

    res.status(200).json({
      status: 'success',
      window_days: windowDays,
      threshold_pct: thresholdPct,
      total_rated: totalRated,
      upvotes: up,
      downvotes: down,
      downvote_rate: downvoteRate,
      alert_triggered: alertTriggered,
      message: alertTriggered
        ? `Downvote rate ${downvoteRate}% is at/above the ${thresholdPct}% threshold over the last ${windowDays} day(s). Check /admin/ai-advice?rating=down for details.`
        : totalRated === 0
          ? `No feedback in the last ${windowDays} day(s) yet.`
          : `Downvote rate ${downvoteRate}% is within the ${thresholdPct}% threshold.`,
    });
  } catch (err) {
    console.error('Advice Alert Check Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = { listFeedback, getStats, checkAlert };
