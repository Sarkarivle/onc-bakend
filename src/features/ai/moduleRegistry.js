const core = require('./prompts/core');
const learning = require('./prompts/learning');
const intelligence = require('./prompts/intelligence');
const search = require('./prompts/search');
const execution = require('./prompts/execution');
const output = require('./prompts/output');
const context = require('./prompts/context');

// Production Quality Modules
const personality = require('./prompts/personality');
const language = require('./prompts/language');
const reasoning = require('./prompts/reasoning_engine');
const validator = require('./prompts/response_validator');
const formatter = require('./prompts/response_formatter');
const hallucination = require('./prompts/hallucination_prevention');
const correction = require('./prompts/correction_engine');
const analytics = require('./prompts/analytics');

// Domain Modules
const govt_jobs = require('./prompts/govt_jobs');
const career = require('./prompts/career_guidance');
const resume = require('./prompts/resume');
const interview = require('./prompts/interview');
const scholarship = require('./prompts/scholarship');
const skills = require('./prompts/skills');
const memory = require('./prompts/memory');
const motivation = require('./prompts/motivation');
const search_decision = require('./prompts/search_decision');
const student_guidance = require('./prompts/student_guidance');
const college = require('./prompts/college');

module.exports = {
    CORE: core,
    LEARNING: learning,
    INTELLIGENCE: intelligence,
    SEARCH: search,
    EXECUTION: execution,
    OUTPUT: output,
    CONTEXT: context,

    // Quality & Intelligence
    PERSONALITY: personality,
    LANGUAGE: language,
    REASONING: reasoning,
    VALIDATOR: validator,
    FORMATTER: formatter,
    HALLUCINATION_PREVENTION: hallucination,
    CORRECTION_ENGINE: correction,
    ANALYTICS: analytics,

    // Domain Expertise
    GOVT_JOB: govt_jobs,
    CAREER: career,
    RESUME: resume,
    INTERVIEW: interview,
    SCHOLARSHIP: scholarship,
    SKILLS: skills,
    MEMORY: memory,
    MOTIVATION: motivation,
    SEARCH_DECISION: search_decision,
    STUDENT_GUIDANCE: student_guidance,
    COLLEGE: college
};
