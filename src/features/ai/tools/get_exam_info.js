/**
 * Academic Engine Tool (get_exam_info)
 * Responsibility: Providing structured syllabus, dates, and info for popular exams.
 */
class AcademicEngine {
    static async execute(args) {
        const { exam_name, info_type } = args;
        const exam = String(exam_name).toLowerCase();

        // Mock Database for popular Indian Exams
        const examDb = {
            "ssc cgl": {
                syllabus: "Tier-1: Maths, Reasoning, English, GS (25 Qs each). Tier-2: Quantitative, English, Stats.",
                dates: "Notifications usually in April-June. Keep checking ssc.gov.in.",
                form_help: "Need 10th/12th details and a valid Graduate degree. Photo rules are strict."
            },
            "up police": {
                syllabus: "General Knowledge, Hindi, Numerical Ability, Mental Aptitude/Reasoning.",
                dates: "Check uppbpb.gov.in for current recruitment cycles.",
                form_help: "Age limit is critical for UP Police. Ensure you have domicile documents ready."
            },
            "ssc gd": {
                syllabus: "Reasoning, GK, Maths, English/Hindi (20 Qs each). CBT format.",
                dates: "Annual recruitment cycle. Follow SSC calendar.",
                form_help: "10th pass is enough. Physical fitness (PET/PST) marks are mandatory."
            }
        };

        const foundExam = Object.keys(examDb).find(key => exam.includes(key));

        if (foundExam && examDb[foundExam][info_type]) {
            return {
                success: true,
                exam: foundExam.toUpperCase(),
                info_type: info_type,
                details: examDb[foundExam][info_type],
                source: "Jobo Academic Database"
            };
        }

        return {
            success: true,
            message: `Bhai, ${exam_name} ki ${info_type} jankari abhi update ho rahi hai. Main live search se check karke batata hoon.`,
            fallback_needed: true
        };
    }
}

module.exports = AcademicEngine;
