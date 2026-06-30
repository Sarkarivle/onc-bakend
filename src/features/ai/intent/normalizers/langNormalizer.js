/**
 * LangNormalizer Module (Formerly IndianLanguageNormalizer)
 * Responsibility: Transliteration & Phonetic Normalization for Hinglish.
 */
class LangNormalizer {
    static normalize(text = "") {
        let n = text.toLowerCase().trim();

        // 1. Phonetic Normalization (Hinglish variants)
        n = n.replace(/\bnaukari\b|\bnokri\b/g, 'naukri')
            .replace(/\bbharti\b|\bbhartiye\b/g, 'bharti')
            .replace(/\bvejancy\b|\bvacensi\b|\bvacansi\b/g, 'vacancy')
            .replace(/\bform\b|\bpharm\b/g, 'form')
            .replace(/\bdate\b|\bdet\b/g, 'date')
            .replace(/\baavedan\b|\bawedan\b/g, 'aavedan')
            .replace(/\bcarrer\b|\bcairer\b/g, 'career')
            .replace(/\bresuma\b|\bresum\b/g, 'resume')
            .replace(/\bsallary\b|\bselary\b/g, 'salary')
            .replace(/\blist\b|\blisat\b/g, 'list')
            .replace(/\btable\b|\btebal\b/g, 'table')
            .replace(/\bqualification\b|\bqualificasion\b/g, 'qualification')
            .replace(/\beligibilty\b|\beligibility\b/g, 'eligibility');

        // 2. Numeric Normalization
        n = n.replace(/\b10vi\b|\bdasvi\b|\bdaswi\b/g, '10th')
            .replace(/\b12vi\b|\bbarvi\b|\bbarwi\b/g, '12th')
            .replace(/\bgradvation\b|\bgraduashun\b/g, 'graduation');

        // 3. Stopword Removal (Selective)
        n = n.replace(/\b(ki|ka|ke|ko|se|me|main|pe|par|bhi|hi)\b/g, ' ');

        return n.replace(/\s+/g, ' ').trim();
    }
}

module.exports = LangNormalizer;
