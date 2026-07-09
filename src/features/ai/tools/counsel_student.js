/**
 * Wellness Engine Tool (counsel_student)
 * Responsibility: Providing structured empathetic support and guidance.
 */
class WellnessEngine {
    static async execute(args, userProfile = {}) {
        const { issue_type } = args;
        const userName = userProfile.name || "Bhai";

        const adviceMap = {
            "motivation": {
                empathy: `${userName} bhai, kabhi kabhi thoda low feel karna normal hai. Tu akela nahi hai.`,
                steps: [
                    "Apne purane achievements ko yaad kar aur dekh tu yahan tak kaise pahuncha.",
                    "Aaj sirf ek chota sa target pura kar, badi jeet chote kadmon se hi milti hai."
                ],
                quote: "Darr mujhe bhi laga faasla dekh kar, par main badhta gaya raasta dekh kar."
            },
            "stress": {
                empathy: "Tension mat le dost, dimaag thanda rakh. Stress se solution nahi, sirf thakaan milti hai.",
                steps: [
                    "5 minute ke liye padhai band kar aur gehri saansein le.",
                    "Ek list bana ki tujhe darr kis baat ka hai, aadha darr likhne se hi khatam ho jayega."
                ],
                quote: "Mushkilein kewal behtareen logon ke hisse mein aati hain."
            },
            "career_confusion": {
                empathy: "Confusion ka matlab hai ki tu apne future ko lekar serious hai, aur ye achi baat hai.",
                steps: [
                    "Apne pasand ke 3 sectors ki list bana aur unki eligibility check kar.",
                    "Mujhse kisi bhi specific exam ke syllabus ke baare mein pooch, main help karunga."
                ],
                quote: "Sahi rasta chunne mein waqt lagta hai, par manzil zaroor milti hai."
            },
            "exam_fear": {
                empathy: "Exam sirf ek paper hai bhai, teri kabliyat ka aakhri faisla nahi.",
                steps: [
                    "Syllabus ko chote parts mein baant kar padh.",
                    "Mock tests de, darr practice se hi bhagega."
                ],
                quote: "Safalta ki unchai par wahi pahunchte hain jo mushkilon se ladna jaante hain."
            }
        };

        const result = adviceMap[issue_type] || adviceMap["motivation"];

        return {
            success: true,
            empathy_statement: result.empathy,
            actionable_advice: result.steps,
            motivation_quote: result.quote,
            instruction: "Bhai, in details ka use karke user ko ek warm aur Bada Bhai wala Hinglish response de. Formatting rules (BLUF/Chunking) yaad rakhna."
        };
    }
}

module.exports = WellnessEngine;
