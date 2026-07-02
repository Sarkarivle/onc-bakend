/**
 * ModuleRegistry Module
 * Responsibility: Static registry of all prompt modules.
 */
const core = require('../prompts/Brainprompt/core');
const learning = require('../prompts/specialists/learning');
const intelligence = require('../prompts/engine/intelligence');
const search = require('../prompts/engine/search');
const execution = require('../prompts/engine/execution');
const output_general = require('../prompts/output/output_general');
const context = require('../prompts/system/context');
const personality = require('../prompts/Brainprompt/personality');
const language = require('../prompts/Brainprompt/language');
const reasoning = require('../prompts/Brainprompt/reasoning_engine');
const validator = require('../prompts/system/response_validator');
const formatter = require('../prompts/system/response_formatter');
const hallucination = require('../prompts/Brainprompt/hallucination_prevention');
const correction = require('../prompts/engine/correction_engine');
const analytics = require('../prompts/engine/analytics');
const govt_jobs = require('../prompts/specialists/govt_jobs');
const career = require('../prompts/specialists/career_guidance');
const resume = require('../prompts/specialists/resume');
const interview = require('../prompts/specialists/interview');
const scholarship = require('../prompts/specialists/scholarship');
const skills = require('../prompts/specialists/skills');
const memory = require('../prompts/system/memory');
const motivation = require('../prompts/specialists/motivation');
const search_decision = require('../prompts/engine/search_decision');
const student_guidance = require('../prompts/specialists/student_guidance');
const college = require('../prompts/specialists/college');

module.exports = {
    CORE: core,
    LEARNING: learning,
    INTELLIGENCE: intelligence,
    SEARCH: search,
    EXECUTION: execution,
    OUTPUT: output_general,
    CONTEXT: context,
    PERSONALITY: personality,
    LANGUAGE: language,
    REASONING: reasoning,
    VALIDATOR: validator,
    FORMATTER: formatter,
    HALLUCINATION_PREVENTION: hallucination,
    CORRECTION_ENGINE: correction,
    ANALYTICS: analytics,
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
