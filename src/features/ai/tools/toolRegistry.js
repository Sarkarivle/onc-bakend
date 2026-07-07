/**
 * ToolRegistry Module (Architectural Version 1.0 - Agentic Toolkit)
 * Responsibility: Defining tool schemas and local implementations for the Agentic Loop.
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
            description: "To query the job RAG/Database for new, active/current jobs, vacancies, or bharti. Use this for specific job searches.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The specific job keyword or title to search (e.g. 'UP Police Constable', 'SSC MTS')" },
                    location: { type: "string", description: "Preferred location for the job" },
                    qualification: { type: "string", description: "Education filter (10th, 12th, Graduate etc.)" }
                },
                required: ["query"]
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
                    issue: { type: "string", description: "The specific problem or emotional state mentioned by the student" }
                },
                required: ["issue"]
            }
        }
    }
];

/**
 * Local Node.js implementations for these tools
 */
const toolImplementations = {
    search_jobs: async (args, context = {}) => {
        console.log("🛠️ Tool Execution: search_jobs", args);
        try {
            const result = await RetrievalEngine.searchJobs(args.query, context.profile || {}, {
                searchStrategy: {
                    location: args.location,
                    qualification: args.qualification
                }
            });
            return {
                success: true,
                count: result.count,
                jobs: result.jobs || "No matching jobs found right now.",
                instruction: "Use these results to answer the user. If no jobs found, suggest they wait for upcoming notifications."
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    get_exam_info: async (args) => {
        console.log("🛠️ Tool Execution: get_exam_info", args);
        // Placeholder for actual Exam Database integration
        return {
            success: true,
            data: `Checking official notification for ${args.exam_name} ${args.info_type}...`,
            instruction: "Provide a general guidance about this exam and tell the user you are looking for specific official updates."
        };
    },

    counsel_student: async (args) => {
        console.log("🛠️ Tool Execution: counsel_student", args);
        return {
            success: true,
            mode: "empathy",
            instruction: "The user needs emotional support. Act as a Bada Bhai/Mentor. Do NOT provide job lists. Provide a roadmap and motivational words in Hinglish."
        };
    }
};

module.exports = {
    toolDefinitions,
    toolImplementations
};
