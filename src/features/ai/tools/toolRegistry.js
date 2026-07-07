/**
 * ToolRegistry Module (Architectural Version 2.0 - Agentic Toolkit)
 * Responsibility: Defining tool schemas and connecting to REAL RAG/Database engines.
 */

const RetrievalEngine = require('../knowledge/retrievalEngine');

/**
 * JSON Schemas for Tool Calling (Groq/OpenAI format)
 */
const toolDefinitions = [
    {
        type: "function",
        function: {
            name: "search_jobs",
            description: "To query the job RAG/Database for new, active/current jobs, vacancies, or bharti. Always include user_filters for accurate pre-filtering.",
            parameters: {
                type: "object",
                properties: {
                    job_keyword: { type: "string", description: "The specific job keyword or title to search (e.g. 'UP Police Constable', 'SSC MTS')" },
                    user_filters: {
                        type: "object",
                        description: "Filters derived from user profile",
                        properties: {
                            gender: { type: "string", enum: ["Male", "Female", "Other"] },
                            max_education: { type: "string", description: "Highest qualification (10th, 12th, Graduate, etc.)" },
                            location_pref: { type: "string", description: "Preferred state or city" }
                        },
                        required: ["gender", "max_education"]
                    }
                },
                required: ["job_keyword", "user_filters"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_exam_info",
            description: "To fetch syllabus, exam pattern, admit cards, result dates, or form-filling details for competitive exams.",
            parameters: {
                type: "object",
                properties: {
                    exam_name: { type: "string", description: "The name of the exam (e.g. 'SSC CGL', 'UPSC', 'CTET')" },
                    info_type: {
                        type: "string",
                        description: "Type of information requested",
                        enum: ["syllabus", "dates", "form_help", "admit_card", "result"]
                    }
                },
                required: ["exam_name", "info_type"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "counsel_student",
            description: "Triggers empathy/motivation mode for students who are depressed, confused about career, or lack motivation.",
            parameters: {
                type: "object",
                properties: {
                    issue_type: {
                        type: "string",
                        description: "The specific problem or emotional state mentioned by the student",
                        enum: ["motivation", "stress", "career_confusion", "exam_fear", "financial_stress"]
                    }
                },
                required: ["issue_type"]
            }
        }
    }
];

/**
 * Local Node.js implementations for these tools
 */
const toolImplementations = {
    /**
     * REAL RAG Integration with Pre-Filtering
     */
    search_jobs: async (args, context = {}) => {
        console.log("🛠️ Tool Execution: search_jobs", args);
        try {
            // Merging LLM-provided filters with context profile if needed
            const profile = {
                ...context.profile,
                gender: args.user_filters?.gender || context.profile?.gender,
                qualification: args.user_filters?.max_education || context.profile?.qualification,
                location: args.user_filters?.location_pref || context.profile?.location
            };

            const result = await RetrievalEngine.searchJobs(args.job_keyword, profile, {
                searchStrategy: {
                    skipLlmExpansion: false,
                    skipLlmRerank: false
                }
            });

            return {
                success: true,
                count: result.count,
                jobs: result.jobs || "Bhai, filhal is keyword ke liye koi nayi vacancy nahi mili. Ek baar spelling check karein ya thoda general keyword use karein.",
                documents: result.documents || [],
                instruction: "Use the provided jobs to answer the user in a helpful, friendly Hinglish tone. If no jobs are found, encourage them to stay motivated and keep checking."
            };
        } catch (error) {
            console.error("❌ search_jobs tool error:", error.message);
            return { success: false, error: "Database search temporarily unavailable." };
        }
    },

    get_exam_info: async (args) => {
        console.log("🛠️ Tool Execution: get_exam_info", args);
        return {
            success: true,
            data: `Searching official records for ${args.exam_name} ${args.info_type}...`,
            instruction: "Tell the user you are checking the latest government notifications for this exam. Provide general guidance if specific dates aren't in training data."
        };
    },

    counsel_student: async (args) => {
        console.log("🛠️ Tool Execution: counsel_student", args);
        return {
            success: true,
            mode: "empathy",
            instruction: `The student is dealing with ${args.issue_type}. Focus on motivation, career roadmaps, and empathy. Address them as 'Bhai' or 'Dost'. Do NOT search for jobs in this turn.`
        };
    }
};

module.exports = {
    toolDefinitions,
    toolImplementations
};
