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
            description: "Search the internal database for government jobs and vacancies.",
            parameters: {
                type: "object",
                properties: {
                    job_keyword: { type: "string", description: "Job title like 'SSC CGL'" },
                    user_filters: {
                        type: "object",
                        properties: {
                            gender: { type: "string", enum: ["Male", "Female", "Other"] },
                            max_education: { type: "string" },
                            location_pref: { type: "string" }
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
            description: "Perform mathematical calculations (percentages, marks).",
            parameters: {
                type: "object",
                properties: {
                    expression: { type: "string", description: "The equation to solve." }
                },
                required: ["expression"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search live web for latest news, university notices, or current affairs.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The search query." }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_document_image",
            description: "Extract text from uploaded images or documents.",
            parameters: {
                type: "object",
                properties: {
                    image_url: { type: "string" }
                },
                required: ["image_url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "execute_system_action",
            description: "Perform system actions like downloading PDFs.",
            parameters: {
                type: "object",
                properties: {
                    action_type: { type: "string", enum: ["download_admit_card", "save_form_data"] },
                    action_payload: { type: "object" }
                },
                required: ["action_type", "action_payload"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_current_time",
            description: "Get the current time in IST.",
            parameters: {
                type: "object",
                properties: {
                    dummy: { type: "string" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_exam_info",
            description: "Fetch syllabus or exam dates.",
            parameters: {
                type: "object",
                properties: {
                    exam_name: { type: "string" },
                    info_type: { type: "string", enum: ["syllabus", "dates", "form_help", "admit_card", "result"] }
                },
                required: ["exam_name", "info_type"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "counsel_student",
            description: "Provide career guidance or motivation.",
            parameters: {
                type: "object",
                properties: {
                    issue_type: { type: "string", enum: ["motivation", "stress", "career_confusion", "exam_fear", "financial_stress"] }
                },
                required: ["issue_type"]
            }
        }
    }
];

/**
 * Local Node.js implementations
 */
const toolImplementations = {
    search_jobs: async (args, userProfile = {}) => {
        try {
            const profile = {
                ...userProfile,
                gender: args.user_filters?.gender || userProfile?.gender,
                qualification: args.user_filters?.max_education || userProfile?.qualification,
                location: args.user_filters?.location_pref || userProfile?.location
            };

            // 1. Fetch raw jobs
            const result = await RetrievalEngine.searchJobs(args.job_keyword, profile);
            const rawJobs = result.documents || [];

            // 2. The Eligibility Bridge
            const eligibleJobs = [];
            for (const job of rawJobs) {
                const report = await EligibilityEngine.evaluate(profile, job, { skipLLM: true });
                if (report.status === 'ELIGIBLE') {
                    // 4. The HTML Fix (CRITICAL)
                    const cleanJob = { ...job };
                    delete cleanJob.fullHtmlContent;
                    delete cleanJob._id;
                    eligibleJobs.push(cleanJob);
                }
            }

            // 5. Return the clean, stringified JSON array
            return {
                success: true,
                count: eligibleJobs.length,
                jobs: eligibleJobs.length > 0 ? JSON.stringify(eligibleJobs) : "No eligible jobs found.",
                documents: eligibleJobs
            };
        } catch (error) {
            console.error("❌ search_jobs tool error:", error);
            return { success: false, error: error.message };
        }
    },

    calculate_math: async (args) => {
        return Calculator.execute(args.expression);
    },

    web_search: async (args) => {
        return await WebSearchTool.search(args.query);
    },

    read_document_image: async (args) => {
        return await OCRTool.read(args.image_url);
    },

    execute_system_action: async (args, userProfile = {}) => {
        return await ActionExecutor.execute(args.action_type, args.action_payload, userProfile);
    },

    get_exam_info: async (args) => {
        return { success: true, data: `Searching records for ${args.exam_name} ${args.info_type}...` };
    },

    get_current_time: async () => {
        const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        return { success: true, current_time: now };
    },

    counsel_student: async (args) => {
        return { success: true, mode: "empathy", issue: args.issue_type };
    }
};

module.exports = {
    toolDefinitions,
    toolImplementations
};
