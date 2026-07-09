/**
 * ToolRegistry Module (Architectural Version 3.0 - Scalable Multi-Agent)
 * Responsibility: Defining tool schemas with categories and connecting to implementations.
 */

const RetrievalEngine = require('../knowledge/retrievalEngine');
const Calculator = require('./calculator');
const EligibilityEngine = require('../../eligibility/EligibilityEngine');
const WebSearchTool = require('./webSearchTool');
const OCRTool = require('./ocrTool');
const ActionExecutor = require('./actionExecutor');
const DateTool = require('./dateTool');
const WellnessEngine = require('./counsel_student');
const AcademicEngine = require('./get_exam_info');
const AgeCalculator = require('../../eligibility/utils/AgeCalculator');

/**
 * JSON Schemas for Tool Calling (Groq/OpenAI format)
 */
const toolDefinitions = [
    {
        category: "JOB_SEARCH",
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
        category: "MATH",
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
        category: "UTILITY",
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
        category: "UTILITY",
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
        category: "UTILITY",
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
        category: "UTILITY",
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
        category: "UTILITY",
        type: "function",
        function: {
            name: "calculate_date_urgency",
            description: "Calculate days remaining or urgency for a given date (e.g., exam date).",
            parameters: {
                type: "object",
                properties: {
                    date: { type: "string", description: "The date to check." }
                },
                required: ["date"]
            }
        }
    },
    {
        category: "UTILITY",
        type: "function",
        function: {
            name: "calculate_age",
            description: "Calculate user's age based on DOB.",
            parameters: {
                type: "object",
                properties: {
                    dob: { type: "string", description: "Date of Birth" }
                }
            }
        }
    },
    {
        category: "JOB_SEARCH",
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
        category: "WELLNESS",
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
    },
    {
        category: "UTILITY",
        type: "function",
        function: {
            name: "update_user_profile",
            description: "Update user's profile with new info like qualification, location, or interests extracted from chat.",
            parameters: {
                type: "object",
                properties: {
                    qualification: { type: "string", description: "e.g., '12th Pass', 'Graduate'" },
                    location: { type: "string", description: "City or State" },
                    skills: { type: "array", items: { type: "string" }, description: "e.g., ['Typing', 'CCC']" },
                    interests: { type: "array", items: { type: "string" }, description: "e.g., ['SSC', 'Police Jobs']" }
                }
            }
        }
    }
];

/**
 * Helper to get tools by category for Supervisor-Worker architecture
 */
const getToolsByCategory = (category) => {
    if (category === 'GENERAL') return [];
    return toolDefinitions
        .filter(t => t.category === category)
        .map(t => {
            const { category, ...rest } = t;
            return rest;
        });
};

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
                education: args.user_filters?.max_education || userProfile?.education || userProfile?.qualification,
                location: args.user_filters?.location_pref || userProfile?.location
            };

            const result = await RetrievalEngine.searchJobs(args.job_keyword, profile);
            const rawJobs = result.documents || [];

            const eligibleJobs = [];
            for (const job of rawJobs) {
                const report = await EligibilityEngine.evaluate(profile, job, { skipLLM: true });
                if (report.status === 'ELIGIBLE') {
                    const cleanJob = { ...job };
                    delete cleanJob.fullHtmlContent;
                    delete cleanJob._id;
                    eligibleJobs.push(cleanJob);
                }
            }

            if (eligibleJobs.length > 0) {
                return {
                    success: true,
                    count: eligibleJobs.length,
                    jobs: JSON.stringify(eligibleJobs),
                    documents: eligibleJobs
                };
            } else if (rawJobs.length > 0) {
                return {
                    success: true,
                    count: 0,
                    jobs: "Jobs exist, but the user is not eligible for any currently active ones. Suggest updating profile or checking other categories.",
                    documents: []
                };
            } else {
                return {
                    success: true,
                    count: 0,
                    jobs: "No matching jobs found in the database.",
                    documents: []
                };
            }
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
        return await AcademicEngine.execute(args);
    },

    get_current_time: async () => {
        const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        return { success: true, current_time: now };
    },

    calculate_date_urgency: async (args) => {
        return DateTool.calculateUrgency(args.date);
    },

    calculate_age: async (args, userProfile = {}) => {
        const dob = args.dob || userProfile.dob;
        if (!dob) return { success: false, error: "DOB missing" };
        return AgeCalculator.calculate(dob, new Date());
    },

    counsel_student: async (args, userProfile = {}) => {
        return await WellnessEngine.execute(args, userProfile);
    },

    update_user_profile: async (args, userProfile = {}) => {
        try {
            const UserProfile = require('../context/userProfile');
            const MemoryEngine = require('../memory/memoryEngine');

            await UserProfile.syncToDb(userProfile.name, {
                qualification: args.qualification,
                state: args.location,
                gender: args.gender
            });

            const userId = userProfile.name;
            if (args.skills) {
                for (const skill of args.skills) {
                    await MemoryEngine.saveMemory(userId, 'SKILL', skill, 0.8);
                }
            }
            if (args.interests) {
                for (const interest of args.interests) {
                    await MemoryEngine.saveMemory(userId, 'GOAL', interest, 0.7);
                }
            }

            console.log(`👤 Profile Updated for ${userProfile.name}:`, args);
            return { success: true, message: "Profile update ho gaya hai, Bhai! Ab main ise hamesha yaad rakhunga." };
        } catch (error) {
            console.error("❌ update_user_profile error:", error);
            return { success: false, error: error.message };
        }
    }
};

module.exports = {
    toolDefinitions,
    toolImplementations,
    getToolsByCategory
};
