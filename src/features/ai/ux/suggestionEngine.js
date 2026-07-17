/**
 * SuggestionEngine Module
 * Responsibility: Generates contextual follow-up suggestions (chips), keyed to the
 * actual intent taxonomy in MasterOrchestrator.ALLOWED_INTENTS — not a separate,
 * disconnected set of intent names that never match what's actually tagged.
 */
class SuggestionEngine {
    static generate(plan, context, aiSuggestions = []) {
        // Priority to Neural Suggestions from LLM
        if (Array.isArray(aiSuggestions) && aiSuggestions.length > 0) {
            return aiSuggestions.slice(0, 3);
        }

        if (!plan) return [];
        const intent = String(plan.intent || '').toUpperCase();
        const hasJobs = context?.jobs && context.jobs.length > 0;
        const suggestions = [];

        const jobFamilyIntents = new Set(['JOB_SEARCH', 'SSC', 'POLICE', 'BANKING', 'RAILWAY', 'UPSC', 'TEACHER']);

        if (jobFamilyIntents.has(intent)) {
            if (hasJobs) {
                suggestions.push(`Apply kaise karein?`, `Eligibility check karo`, `Age limit kya hai?`);
            } else {
                suggestions.push(`Meri qualification ke hisaab se jobs dikhao`, `Latest sarkari vacancy batao`, `Exam preparation tips do`);
            }
        } else if (intent === 'ROADMAP') {
            suggestions.push(`30-60-90 din ka plan do`, `12th ke baad best options`, `Sarkari job vs private job`);
        } else if (intent === 'GRANTS' || intent === 'PART_TIME') {
            suggestions.push(`Scholarship eligibility batao`, `Application deadline kya hai`, `Documents kaunse chahiye`);
        } else if (intent === 'ACADEMIC_AUDIT') {
            suggestions.push(`Meri marksheet analyze karo`, `Kaunsa career fit karega`, `Weak subjects kaise improve karu`);
        } else if (intent === 'WELLNESS') {
            suggestions.push(`Stress kam karne ke tips do`, `Study break kaise lu`, `Motivation chahiye`);
        } else if (intent === 'SYLLABUS' || intent === 'PYQ') {
            suggestions.push(`Previous year papers do`, `Important topics batao`, `Mock test schedule banao`);
        } else if (intent === 'CONCEPT' || intent === 'MATH' || intent === 'CODING') {
            suggestions.push(`Ek aur example do`, `Practice question do`, `Shortcut trick batao`);
        } else if (intent === 'INTERVIEW') {
            suggestions.push(`Common interview questions do`, `Group discussion tips do`, `Body language advice do`);
        } else if (intent === 'DRAFTING' || intent === 'EMAIL_PRO') {
            suggestions.push(`Isko aur formal banao`, `Ek aur template do`, `Grammar check karo`);
        } else if (intent === 'SCAM_PROTECTOR') {
            suggestions.push(`Yeh job genuine hai ya scam?`, `Safe job portals batao`, `Fraud report kaise karu`);
        } else if (intent === 'LOCAL_SCOUT') {
            suggestions.push(`Nearby coaching batao`, `Library ka address do`, `Cyber cafe kahan hai`);
        }

        return [...new Set(suggestions)]
            .filter(s => s.length > 2 && s.length < 35)
            .slice(0, 3);
    }
}

module.exports = SuggestionEngine;
