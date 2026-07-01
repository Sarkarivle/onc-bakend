/**
 * LanguageDetector Module
 * Responsibility: Identifies the language of the user query (Hinglish, Hindi, English).
 */
class LanguageDetector {
    static detect(query) {
        const hindiRegex = /[\u0900-\u097F]/;
        const englishRegex = /^[A-Za-z0-9\s.,!?-]+$/;

        if (hindiRegex.test(query)) {
            return { lang: 'hi', label: 'Hindi', confidence: 0.95 };
        }

        // Very basic Hinglish check: common Hinglish words
        const hinglishWords = ['hai', 'kar', 'raha', 'ko', 'mein', 'bhai', 'kya', 'kaise', 'tha', 'thi', 'hua'];
        const words = query.toLowerCase().split(/\s+/);
        const hinglishCount = words.filter(w => hinglishWords.includes(w)).length;

        if (hinglishCount > 0) {
            return { lang: 'hi-en', label: 'Hinglish', confidence: 0.8 };
        }

        if (englishRegex.test(query)) {
            return { lang: 'en', label: 'English', confidence: 0.9 };
        }

        return { lang: 'hi-en', label: 'Hinglish', confidence: 0.5 }; // Default to Hinglish for this specific app
    }
}

module.exports = LanguageDetector;
