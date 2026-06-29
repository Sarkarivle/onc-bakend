function add(result, key, value) {
  if (!value) return;
  if (!result[key]) result[key] = [];
  if (!result[key].includes(value)) result[key].push(value);
}

function extract(input) {
  const text = String(input?.normalizedText || input?.query || input?.message || input?.userMessage || input || '').toLowerCase();
  const result = {};

  if (/\b(up|uttar pradesh)\b/.test(text)) add(result, 'state', 'up');
  if (/\bpolice|pulis\b/.test(text)) add(result, 'department', 'police');
  if (/\brailway|rrb\b/.test(text)) add(result, 'department', 'railway');
  if (/\bssc\b/.test(text)) add(result, 'department', 'ssc');
  if (/\bbank\b/.test(text)) add(result, 'department', 'bank');

  if (/\bconstable\b/.test(text)) add(result, 'postName', 'constable');
  if (/\bpo\b/.test(text)) add(result, 'postName', 'po');
  if (/\bcgl\b/.test(text)) add(result, 'examName', 'cgl');

  if (/\b10th\b|10 pass|dasvi/.test(text)) add(result, 'qualification', '10th');
  if (/\b12th\b|12 pass|barahvi/.test(text)) add(result, 'qualification', '12th');

  if (/age|umar|age limit/.test(text)) add(result, 'ageQuery', 'age');
  if (/fee|fees/.test(text)) add(result, 'feesQuery', 'fees');
  if (/salary|sallery|vetan|pay/.test(text)) add(result, 'salaryQuery', 'salary');
  if (/last date|last det/.test(text)) add(result, 'lastDateQuery', 'last date');
  if (/vacancy|seat|post kitni/.test(text)) add(result, 'vacancyQuery', 'vacancy');
  if (/apply|official link|link/.test(text)) add(result, 'applyLinkQuery', 'apply link');

  const year = text.match(/\b(20\d{2})\b/);
  if (year) add(result, 'year', year[1]);

  const ref = text.match(/\b(\d+)\s*(no|number|num)\b/);
  if (ref) add(result, 'numericReference', ref[1]);

  return result;
}

module.exports = { extract, extractEntities: extract, analyze: extract, default: extract };
