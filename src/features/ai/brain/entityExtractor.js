class EntityExtractor {
  add(result, key, value) {
    if (!value) return;
    if (!result[key]) result[key] = [];
    if (!result[key].includes(value)) result[key].push(value);
  }

  toText(input) {
    if (typeof input === 'string') return input.toLowerCase();
    return String(
      input?.normalizedText ||
      input?.query ||
      input?.message ||
      input?.userMessage ||
      input?.text ||
      ''
    ).toLowerCase();
  }

  extract(input) {
    const text = this.toText(input);
    const result = {};

    if (/\b(up|uttar pradesh)\b/.test(text)) this.add(result, 'state', 'up');
    if (/\bbihar\b/.test(text)) this.add(result, 'state', 'bihar');
    if (/\bjharkhand\b/.test(text)) this.add(result, 'state', 'jharkhand');

    if (/\b(police|pulis)\b/.test(text)) this.add(result, 'department', 'police');
    if (/\b(railway|rrb)\b/.test(text)) this.add(result, 'department', 'railway');
    if (/\bssc\b/.test(text)) this.add(result, 'department', 'ssc');
    if (/\bbank\b/.test(text)) this.add(result, 'department', 'bank');
    if (/\bupsc\b/.test(text)) this.add(result, 'department', 'upsc');
    if (/\b(teacher|teaching|tet|ctet)\b/.test(text)) this.add(result, 'department', 'teacher');

    if (/\bconstable\b/.test(text)) this.add(result, 'postName', 'constable');
    if (/\bpo\b/.test(text)) this.add(result, 'postName', 'po');
    if (/\bcgl\b/.test(text)) this.add(result, 'examName', 'cgl');

    if (/\b10th\b|10 pass|dasvi/.test(text)) this.add(result, 'qualification', '10th');
    if (/\b12th\b|12 pass|barahvi/.test(text)) this.add(result, 'qualification', '12th');
    if (/\bgraduate|graduation\b/.test(text)) this.add(result, 'qualification', 'graduation');

    if (/\bage|umar|umra|age limit\b/.test(text)) this.add(result, 'ageQuery', 'age');
    if (/\bfee|fees|form fee|application fee\b/.test(text)) this.add(result, 'feesQuery', 'fees');
    if (/\bsalary|sallery|pay|vetan\b/.test(text)) this.add(result, 'salaryQuery', 'salary');
    if (/\blast date|last det\b/.test(text)) this.add(result, 'lastDateQuery', 'last date');
    if (/\bvacancy|seat|post kitni\b/.test(text)) this.add(result, 'vacancyQuery', 'vacancy');
    if (/\bapply|official link|link\b/.test(text)) this.add(result, 'applyLinkQuery', 'apply link');

    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (yearMatch) this.add(result, 'year', yearMatch[1]);

    const numMatch = text.match(/\b(\d+)\s*(no|number|num)\b/);
    if (numMatch) this.add(result, 'numericReference', numMatch[1]);

    return result;
  }

  analyze(input) {
    return this.extract(input);
  }

  extractEntities(input) {
    return this.extract(input);
  }

  static extract(input) {
    return new EntityExtractor().extract(input);
  }

  static analyze(input) {
    return new EntityExtractor().extract(input);
  }

  static extractEntities(input) {
    return new EntityExtractor().extract(input);
  }
}

module.exports = EntityExtractor;
