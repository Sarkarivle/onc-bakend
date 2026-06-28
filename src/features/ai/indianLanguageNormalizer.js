/**
 * IndianLanguageNormalizer
 * Normalizes Hindi/Hinglish typos, variants, and regional phrasing before intent resolution.
 */
class IndianLanguageNormalizer {
    static normalize(input = "") {
        let text = String(input)
            .toLowerCase()
            .normalize('NFKC')
            .replace(/[?؟!.,;:"'`~()[\]{}]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const replacements = [
            [/\b(nokri|naukari|naukri|naukrii|noukri|naokri| नौकरी)\b/g, 'job'],
            [/\b(rojgar|rozgar|rojgaar|rozgaar|रोजगार)\b/g, 'job'],
            [/\b(kaam|kam|काम)\s+(chahiye|chaiye|chaie|chahie)\b/g, 'job chahiye'],
            [/\b(bharti|भर्ती|recruitment|vacancy|vacanci|vacency)\b/g, 'vacancy'],
            [/\b(form|फॉर्म)\s+(nikla|nikal|nikali|aaya|aya|open)\b/g, 'application form open'],
            [/\b(apply|aply|aplly|online apply|awedan|aavedan|avedan|आवेदन)\b/g, 'apply'],
            [/\b(reslt|rezult|parinam|parinaam|परिणाम)\b/g, 'result'],
            [/\b(admit\s*crd|admit\s*card|hall ticket|pravesh patra|प्रवेश पत्र)\b/g, 'admit card'],
            [/\b(fees|fee|shulk|sulk|फीस)\b/g, 'fee'],
            [/\b(umar|umr|aayu|age limit|आयु)\b/g, 'age'],
            [/\b(yogyata|योग्यता|qualification|educational qualification|padhai)\b/g, 'eligibility'],
            [/\b(vetan|salary|pay scale|payscale|वेतन)\b/g, 'salary'],
            [/\b(paisa|paise|paise kamane|earning|kamai|income)\b/g, 'earning'],
            [/\b(rasta|raasta|tareeka|tarika|way)\b/g, 'option'],
            [/\b(sahi se|achhe se|detail me|details do|details dikhao)\b/g, 'details'],
            [/\b(settle|settled|future secure|career banana)\b/g, 'career'],
            [/\b(cv|biodata|bio data)\b/g, 'resume'],
            [/\b(chatravriti|chhatravriti|wazifa|scholership)\b/g, 'scholarship'],
            [/\b(haan|han|ha|haa|ji haan)\b/g, 'haan'],
            [/\b(nhi|nai|nahin|naah)\b/g, 'nahi']
        ];

        for (const [pattern, replacement] of replacements) {
            text = text.replace(pattern, replacement);
        }

        return text.replace(/\s+/g, ' ').trim();
    }
}

module.exports = IndianLanguageNormalizer;
