/**
 * ToolRegistry Module (Architectural Version 2.0 - Agentic Toolkit)
 * Responsibility: Defining tool schemas and connecting to REAL RAG/Database engines.
 */

const RetrievalEngine = require('../knowledge/retrievalEngine');
const Calculator = require('./calculator');
const EligibilityEngine = require('../../eligibility/EligibilityEngine');
const WebSearchTool = require('./webSearchTool');
const OCRTool = require('./ocrTool');
const ActionExecutor = require('./actionExecutor');

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
            name: "calculate_math",
            description: "Use this to accurately calculate percentages, marks, age differences, or any math equation. NEVER calculate math in your head.",
            parameters: {
                type: "object",
                properties: {
                    expression: { type: "string", description: "The math expression to evaluate (e.g., '435/600 * 100')" }
                },
                required: ["expression"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "check_eligibility",
            description: "Use this to perform a detailed eligibility check for a specific job. Requires a job object from search results.",
            parameters: {
                type: "object",
                properties: {
                    job_title: { type: "string", description: "The title of the job to check eligibility for." },
                    job_data: { type: "object", description: "The full job data object returned from search_jobs." }
                },
                required: ["job_title", "job_data"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_live_web",
            description: "Use this ONLY when the user asks for today's news, live current affairs, or the latest website notifications that might not be in the static database.",
            parameters: {
                type: "object",
                properties: {
                    search_query: { type: "string", description: "The query to search on the live web (e.g., 'SSC official notice today')" }
                },
                required: ["search_query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_document_image",
            description: "Use this to extract text, marks, and details from an image or document provided by the user.",
            parameters: {
                type: "object",
                properties: {
                    image_url: { type: "string", description: "The URL or base64 string of the image to read." }
                },
                required: ["image_url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "execute_system_action",
            description: "Use this to perform physical actions on behalf of the user, such as downloading PDFs or saving form data.",
            parameters: {
                type: "object",
                properties: {
                    action_type: {
                        type: "string",
                        enum: ["download_admit_card", "save_form_data"],
                        description: "The type of action to perform."
                    },
                    action_payload: {
                        type: "object",
                        description: "Necessary data for the action."
                    }
                },
                required: ["action_type", "action_payload"]
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
            name: "get_current_time",
            description: "Get the current time in Indian Standard Time (IST).",
            parameters: {
                type: "object",
                properties: {
                    timezone: { type: "string", description: "Default is Asia/Kolkata" }
                },
                required: []
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

    calculate_math: async (args) => {
        console.log("🛠️ Tool Execution: calculate_math", args);
        return Calculator.execute(args.expression);
    },

    check_eligibility: async (args, context = {}) => {
        console.log("🛠️ Tool Execution: check_eligibility", args.job_title);
        try {
            if (!context.profile) return { success: false, error: "User profile missing for eligibility check." };

            const report = await EligibilityEngine.evaluate(context.profile, args.job_data);
            return {
                success: true,
                status: report.status,
                verdict: report.summary,
                advice: report.dost_advice,
                match_score: report.match_score,
                instruction: "Present this eligibility report to the student in a brotherly tone. If ineligible, explain why gently and suggest alternatives."
            };
        } catch (error) {
            console.error("❌ check_eligibility tool error:", error.message);
            return { success: false, error: "Eligibility engine error." };
        }
    },

    search_live_web: async (args) => {
        console.log("🛠️ Tool Execution: search_live_web", args);
        return await WebSearchTool.search(args.search_query);
    },

    read_document_image: async (args) => {
        console.log("🛠️ Tool Execution: read_document_image", args);
        return await OCRTool.read(args.image_url);
    },

    execute_system_action: async (args, context = {}) => {
        console.log("🛠️ Tool Execution: execute_system_action", args);
        return await ActionExecutor.execute(args.action_type, args.action_payload, context);
    },

    get_exam_info: async (args) => {
        console.log("🛠️ Tool Execution: get_exam_info", args);
        return {
            success: true,
            data: `Searching official records for ${args.exam_name} ${args.info_type}...`,
            instruction: "Tell the user you are checking the latest government notifications for this exam. Provide general guidance if specific dates aren't in training data."
        };
    },

    get_current_time: async () => {
        const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        console.log("🛠️ Tool Execution: get_current_time", now);
        return { success: true, current_time: now, instruction: "Tell the user the current time in a friendly way." };
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
