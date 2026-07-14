const OfficialSource = require('./sourceModel');
const SourceService = require('./sourceService');

const listSources = async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = String(req.query.type).toUpperCase();
  if (req.query.active !== undefined) filter.isActive = req.query.active !== 'false';

  const sources = await OfficialSource.find(filter).sort({ type: 1, name: 1 }).limit(200);
  res.json({ status: 'success', count: sources.length, sources });
};

const upsertSource = async (req, res) => {
  const source = await SourceService.upsertSource(req.body, req.user);
  res.status(201).json({ status: 'success', source });
};

const refreshSource = async (req, res) => {
  const source = await OfficialSource.findById(req.params.id);
  if (!source) return res.status(404).json({ status: 'fail', message: 'Source not found' });
  const result = await SourceService.fetchOne(source);
  res.json({ status: 'success', result });
};

const refreshDue = async (req, res) => {
  const limit = Number(req.query.limit || 20);
  const result = await SourceService.refreshDue({ limit });
  res.json({ status: 'success', ...result });
};

const health = async (req, res) => {
  const report = await SourceService.healthReport();
  res.json({ status: 'success', report });
};

module.exports = {
  listSources,
  upsertSource,
  refreshSource,
  refreshDue,
  health
};
