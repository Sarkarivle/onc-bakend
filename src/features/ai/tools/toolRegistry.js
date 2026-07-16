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
const ImageAnalyzer = require('./imageAnalyzer');
const DashboardTool = require('./dashboardTool');
const PDFGenerator = require('./pdfGenerator');
const YouTubeTool = require('./youtubeTool');
const LocalResourceTool = require('./localResourceTool');
const ReminderTool = require('./reminderTool');
const FileConverterTool = require('./fileConverterTool');
const QuizTool = require('./quizTool');
const ProgressTrackerTool = require('./progressTrackerTool');
const FinanceCalculatorTool = require('./financeCalculatorTool');
const FlashcardTool = require('./flashcardTool');
const ScholarshipSearchTool = require('./scholarshipSearchTool');
const DeepContentSummarizer = require('./deep_content_summarizer');
const InternshipFinder = require('./internship_finder');
const GrammarStyleChecker = require('./grammar_style_checker');
const ExamCenterLocator = require('./exam_center_locator');
const CitationBuilder = require('./citation_builder');
const ComparisonTableTool = require('./comparisonTableTool');
const Grounding = require('../quality/grounding');

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
                    gender: { type: "string", enum: ["Male", "Female", "Other"], description: "Only include if known from profile/history." },
                    max_education: { type: "string", description: "Only include if known from profile/history." },
                    location_pref: { type: "string", description: "Only include if known from profile/history." }
                },
                required: ["job_keyword"]
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
            name: "create_comparison_table",
            description: "Generate a professional, scrollable Markdown table for comparing career options or features.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "The heading for the table." },
                    headers: { type: "array", items: { type: "string" }, description: "Column names (e.g. ['Feature', 'SSC CGL', 'Banking'])" },
                    rows: {
                        type: "array",
                        items: {
                            type: "array",
                            items: { type: "string" }
                        },
                        description: "Data rows. Each row is an array of strings."
                    }
                },
                required: ["title", "headers", "rows"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["DRAFTING", "INTERVIEW"],
        type: "function",
        function: {
            name: "web_search",
            description: "Search live web for latest news, university notices, resume formats, or interview questions.",
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
        secondary_categories: ["DRAFTING"],
        type: "function",
        function: {
            name: "analyze_image",
            description: "Analyze an image (Base64) using Vision AI to extract info, marks, job details, or review resumes.",
            parameters: {
                type: "object",
                properties: {
                    image_url: { type: "string", description: "Base64 data URI of the image" },
                    prompt: { type: "string", description: "What to look for in the image" }
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
                    action_payload: {
                        type: "object",
                        description: "Metadata for the action",
                        properties: {},
                        additionalProperties: true
                    }
                },
                required: ["action_type"]
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
                },
                required: []
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
                    dob: { type: "string", description: "Date of Birth (YYYY-MM-DD)" }
                },
                required: ["dob"]
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
            name: "get_user_dashboard_stats",
            description: "Get real-time counts for matching jobs, grants (schemes), and saved career plans for the user.",
            parameters: {
                type: "object",
                properties: {
                    dummy: { type: "string" }
                },
                required: []
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
                },
                required: []
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["DRAFTING"],
        type: "function",
        function: {
            name: "generate_pdf_draft",
            description: "Generate a downloadable PDF for a resume, cover letter, or application.",
            parameters: {
                type: "object",
                properties: {
                    content: { type: "string", description: "The text content to be put into the PDF." },
                    file_name: { type: "string", description: "Suggested name for the file (e.g., 'My_Resume.pdf')" }
                },
                required: ["content"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["CONCEPT", "ROADMAP", "SYLLABUS"],
        type: "function",
        function: {
            name: "youtube_educational_search",
            description: "Search YouTube for the best educational videos on a specific topic.",
            parameters: {
                type: "object",
                properties: {
                    topic: { type: "string", description: "The educational topic to search for." }
                },
                required: ["topic"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["LOCAL_SCOUT", "ROADMAP"],
        type: "function",
        function: {
            name: "map_local_resources",
            description: "Find local libraries, coaching centers, or cyber cafes near the user's location.",
            parameters: {
                type: "object",
                properties: {
                    resource_type: { type: "string", enum: ["Library", "Coaching", "Cyber Cafe", "Exam Center"] },
                    location: { type: "string", description: "The city or area to search in." }
                },
                required: ["resource_type", "location"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["ROADMAP", "JOB_SEARCH"],
        type: "function",
        function: {
            name: "set_career_reminder",
            description: "Set a reminder for important exam dates, interview times, or application deadlines.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "What the reminder is for." },
                    date: { type: "string", description: "Date and time of the reminder (YYYY-MM-DD HH:mm)." }
                },
                required: ["title", "date"]
            }
        }
    },
    {
        category: "UTILITY",
        type: "function",
        function: {
            name: "smart_file_converter",
            description: "Convert images to PDF or resize images to meet exam form requirements (e.g., under 200kb).",
            parameters: {
                type: "object",
                properties: {
                    file_url: { type: "string", description: "The URL or path of the file to convert." },
                    target_format: { type: "string", enum: ["PDF", "JPEG", "PNG"] },
                    max_size_kb: { type: "number", description: "Target max size in KB" }
                },
                required: ["file_url", "target_format"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["SYLLABUS", "CONCEPT"],
        type: "function",
        function: {
            name: "mock_quiz_generator",
            description: "Generate practice questions for various subjects/exams.",
            parameters: {
                type: "object",
                properties: {
                    subject: { type: "string", description: "e.g., 'Math', 'History', 'SSC English'" },
                    count: { type: "number", description: "Number of questions to generate" }
                },
                required: ["subject"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["ROADMAP"],
        type: "function",
        function: {
            name: "syllabus_progress_tracker",
            description: "Track completion of study topics and get overall stats.",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["update", "get_stats"] },
                    topic: { type: "string", description: "The study topic to update" },
                    status: { type: "string", enum: ["DONE", "PENDING"] }
                },
                required: ["action"]
            }
        }
    },
    {
        category: "MATH",
        type: "function",
        function: {
            name: "loan_emi_calculator",
            description: "Calculate loan EMIs and repayment plans for students.",
            parameters: {
                type: "object",
                properties: {
                    amount: { type: "number" },
                    interest_rate: { type: "number", description: "Annual interest rate in %" },
                    tenure_years: { type: "number", description: "Loan tenure in years" }
                },
                required: ["amount", "interest_rate", "tenure_years"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["CONCEPT"],
        type: "function",
        function: {
            name: "flashcard_creator",
            description: "Generate digital flashcards from notes or text for quick revision.",
            parameters: {
                type: "object",
                properties: {
                    content: { type: "string", description: "The text to convert into flashcards" }
                },
                required: ["content"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["GRANTS"],
        type: "function",
        function: {
            name: "scholarship_deep_search",
            description: "Find specific scholarships based on user profile and category.",
            parameters: {
                type: "object",
                properties: {
                    category: { type: "string" },
                    gender: { type: "string" },
                    qualification: { type: "string" }
                },
                required: []
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["SYLLABUS", "CONCEPT", "ACADEMIC_AUDIT"],
        type: "function",
        function: {
            name: "deep_content_summarizer",
            description: "Summarize large texts, PDFs, or web pages into exam-ready bullet points.",
            parameters: {
                type: "object",
                properties: {
                    text: { type: "string", description: "The text content to summarize." },
                    url: { type: "string", description: "URL of the page to summarize." },
                    mode: { type: "string", enum: ["EXAM_READY", "GENERAL"], default: "EXAM_READY" }
                },
                required: []
            }
        }
    },
    {
        category: "JOB_SEARCH",
        secondary_categories: ["PART_TIME"],
        type: "function",
        function: {
            name: "internship_finder",
            description: "Find relevant and paid internships for students.",
            parameters: {
                type: "object",
                properties: {
                    field: { type: "string", description: "Field of internship (e.g., 'Web Development', 'Marketing')" },
                    location: { type: "string", description: "City or 'Remote'" },
                    type: { type: "string", enum: ["Paid", "Unpaid", "Both"], default: "Paid" }
                },
                required: ["field"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["DRAFTING", "EMAIL_PRO", "ENGLISH_PRACTICE"],
        type: "function",
        function: {
            name: "grammar_style_checker",
            description: "Improve tone and structure of writing (Emails, Assignments, Messages).",
            parameters: {
                type: "object",
                properties: {
                    text: { type: "string", description: "The text to check and improve." },
                    target_tone: { type: "string", enum: ["Professional", "Friendly", "Academic", "Concise"], default: "Professional" }
                },
                required: ["text"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["LOCAL_SCOUT"],
        type: "function",
        function: {
            name: "exam_center_locator",
            description: "Locate exam center and provide travel estimation from user location.",
            parameters: {
                type: "object",
                properties: {
                    center_name: { type: "string", description: "Name of the exam center from admit card." },
                    user_location: { type: "string", description: "User's current city or area." }
                },
                required: ["center_name"]
            }
        }
    },
    {
        category: "UTILITY",
        secondary_categories: ["ACADEMIC_AUDIT"],
        type: "function",
        function: {
            name: "citation_builder",
            description: "Generate bibliography/citations for academic assignments in APA/MLA format.",
            parameters: {
                type: "object",
                properties: {
                    source_link: { type: "string" },
                    source_title: { type: "string" },
                    author: { type: "string" },
                    year: { type: "string" },
                    format: { type: "string", enum: ["APA", "MLA", "Harvard"], default: "APA" }
                },
                required: ["source_link"]
            }
        }
    }
];

/**
 * Helper to get tools by category for Supervisor-Worker architecture
 */
const getToolsByCategory = (categories) => {
    // Convert to array if it's a single string
    const categoryList = Array.isArray(categories) ? categories : [categories];

    const mandatoryTools = toolDefinitions
        .filter(t => ['update_user_profile', 'get_current_time', 'search_jobs', 'get_user_dashboard_stats'].includes(t.function.name))
        .map(t => {
            const { category, secondary_categories, ...rest } = t;
            return rest;
        });

    if (categoryList.includes('GENERAL')) return mandatoryTools;

    const categoryTools = toolDefinitions
        .filter(t =>
            categoryList.includes(t.category) ||
            (t.secondary_categories && t.secondary_categories.some(cat => categoryList.includes(cat))) ||
            (categoryList.includes('NEWS') && t.category === 'UTILITY') ||
            (categoryList.includes('GRANTS') && t.category === 'UTILITY') ||
            (categoryList.includes('ACADEMIC_AUDIT') && t.category === 'UTILITY')
        )
        .map(t => {
            const { category, secondary_categories, ...rest } = t;
            return rest;
        });

    // Merge and deduplicate
    const allTools = [...categoryTools, ...mandatoryTools];
    return Array.from(new Map(allTools.map(t => [t.function.name, t])).values());
};

/**
 * Local Node.js implementations
 */
const toolImplementations = {
    search_jobs: async (args, userProfile = {}) => {
        try {
            const profile = {
                ...userProfile,
                gender: args.gender || args.user_filters?.gender || userProfile?.gender,
                qualification: args.max_education || args.user_filters?.max_education || userProfile?.qualification,
                education: args.max_education || args.user_filters?.max_education || userProfile?.education || userProfile?.qualification,
                location: args.location_pref || args.user_filters?.location_pref || userProfile?.location
            };

            const result = await RetrievalEngine.searchJobs(args.job_keyword, profile);
            const allCandidates = result.documents || [];

            const verifiedJobs = [];
            const ineligibilityReasons = [];

            for (const job of allCandidates) {
                if (job.eligibility?.status === 'ELIGIBLE') {
                    const cleanJob = { ...job };
                    delete cleanJob.fullHtmlContent;
                    delete cleanJob._id;
                    cleanJob.evidence = Grounding.fromJob(job);
                    verifiedJobs.push(cleanJob);
                } else {
                    ineligibilityReasons.push({
                        title: job.title,
                        status: job.eligibility?.status || 'INELIGIBLE',
                        reason: job.eligibility?.reason || "Criteria mismatch"
                    });
                }
            }

            if (verifiedJobs.length === 0) {
                return {
                    status: "EMPTY_RESULT",
                    message: "Bhai, abhi teri profile ke hisaab se koi active form nahi hai.",
                    explanation: ineligibilityReasons.length > 0
                        ? "Matching jobs were found but you are currently ineligible. Here is why:"
                        : "No jobs found matching the keyword.",
                    details: ineligibilityReasons.slice(0, 3),
                    evidence: []
                };
            }

            const evidence = verifiedJobs.map(job => job.evidence).filter(Boolean);
            return {
                status: "SUCCESS",
                jobs: verifiedJobs,
                evidence,
                grounding: Grounding.summarize(evidence)
            };
        } catch (error) {
            console.error("❌ search_jobs tool error:", error);
            return { success: false, error: error.message };
        }
    },

    create_comparison_table: async (args) => {
        return await ComparisonTableTool.generate(args);
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

    analyze_image: async (args) => {
        return await ImageAnalyzer.analyze(args.image_url, args.prompt);
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

    get_user_dashboard_stats: async (args, userProfile = {}) => {
        return await DashboardTool.getStats(userProfile);
    },

    update_user_profile: async (args, userProfile = {}) => {
        try {
            if (!userProfile.name || ['User', 'Guest'].includes(userProfile.name)) {
                return { success: false, skipped: true, message: "Login ke baad profile memory save hogi." };
            }
            const UserProfile = require('../context/userProfile');
            const MemoryEngine = require('../memory/memoryEngine');
            const cleanSkills = (args.skills || []).map(s => String(s || '').trim()).filter(Boolean);
            const cleanInterests = (args.interests || []).map(s => String(s || '').trim()).filter(Boolean);

            await UserProfile.syncToDb(userProfile.name, {
                qualification: String(args.qualification || '').trim() || undefined,
                state: String(args.location || '').trim() || undefined,
                gender: String(args.gender || '').trim() || undefined
            });

            const userId = userProfile.name;
            if (cleanSkills.length > 0) {
                for (const skill of cleanSkills) {
                    await MemoryEngine.saveMemory(userId, 'SKILL', skill, 0.8);
                }
            }
            if (cleanInterests.length > 0) {
                for (const interest of cleanInterests) {
                    await MemoryEngine.saveMemory(userId, 'GOAL', interest, 0.7);
                }
            }

            console.log(`👤 Profile Updated for ${userProfile.name}:`, args);
            return { success: true, message: "Profile update ho gaya hai, Bhai! Ab main ise hamesha yaad rakhunga." };
        } catch (error) {
            console.error("❌ update_user_profile error:", error);
            return { success: false, error: error.message };
        }
    },

    generate_pdf_draft: async (args) => {
        return await PDFGenerator.generate(args.content, args.file_name);
    },

    youtube_educational_search: async (args) => {
        return await YouTubeTool.search(args.topic);
    },

    map_local_resources: async (args) => {
        return await LocalResourceTool.find(args.resource_type, args.location);
    },

    set_career_reminder: async (args, userProfile = {}) => {
        return await ReminderTool.set(args.title, args.date, userProfile.name);
    },

    smart_file_converter: async (args) => {
        return await FileConverterTool.convert(args.file_url, args.target_format, args.max_size_kb);
    },

    mock_quiz_generator: async (args) => {
        return await QuizTool.generate(args.subject, args.count);
    },

    syllabus_progress_tracker: async (args, userProfile = {}) => {
        if (args.action === 'update') {
            return await ProgressTrackerTool.updateProgress(userProfile.name, args.topic, args.status);
        }
        return await ProgressTrackerTool.getStats(userProfile.name);
    },

    loan_emi_calculator: async (args) => {
        return FinanceCalculatorTool.calculateEMI(args.amount, args.interest_rate, args.tenure_years);
    },

    flashcard_creator: async (args) => {
        return await FlashcardTool.create(args.content);
    },

    scholarship_deep_search: async (args, userProfile = {}) => {
        const profile = {
            category: args.category || userProfile.category,
            gender: args.gender || userProfile.gender,
            location: userProfile.location,
            qualification: args.qualification || userProfile.qualification
        };
        return await ScholarshipSearchTool.deepSearch(profile);
    },

    deep_content_summarizer: async (args) => {
        return await DeepContentSummarizer.summarize(args);
    },

    internship_finder: async (args) => {
        return await InternshipFinder.find(args);
    },

    grammar_style_checker: async (args) => {
        return await GrammarStyleChecker.check(args);
    },

    exam_center_locator: async (args) => {
        return await ExamCenterLocator.locate(args);
    },

    citation_builder: async (args) => {
        return await CitationBuilder.build(args);
    }
};

module.exports = {
    toolDefinitions,
    toolImplementations,
    getToolsByCategory
};
