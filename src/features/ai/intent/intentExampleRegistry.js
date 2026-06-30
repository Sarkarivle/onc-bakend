/**
 * IntentExampleRegistry Module
 * Responsibility: Store semantic examples and metadata for intent matching.
 */

const INTENT_EXAMPLES = {
    GREETING: [
        "hi", "hello", "kaise ho", "namaste", "ram ram", "hey", "hii", "heyy", "adaab", "namaskar",
        "good morning", "good evening", "shubh sandhya", "suprabhat", "kya haal hai", "hello jobo", "hi jobo",
        "hi kaise ho", "bhai kaise ho", "jobo kaise ho", "suno", "are bhai"
    ],
    JOB_QUERY: [
        "job batao", "mere liye koi job hai kya", "kaam chahiye", "rojgar chahiye", "earning ke liye option",
        "form nikla hai kya", "bharti batao", "nayi vacancy", "sarkari naukri", "latest jobs",
        "mere liye kuch kaam hai kya", "paise kamane ke liye kya karu", "apply wali koi cheez hai kya",
        "naukri ka option batao", "koi bharti hai kya", "government me chance hai kya",
        "mere qualification pe kya milega", "form aaya hai kya", "vacancy open hai kya", "koi kaam dila do",
        "sarkari form batao", "open post batao", "mere liye opening hai kya", "naukri chahiye",
        "job option dikhao", "latest form batao", "kaha apply kar sakta hu", "bharti nikli hai kya",
        "kaam ka option", "sarkari rojgar", "apply karne wali vacancy", "data me jobs dikhao"
    ],
    MORE_RESULTS: [
        "aur hai kya", "1 hi hai kya", "sirf itna hi", "next", "aur batao", "dusra option", "more jobs",
        "show more", "next page", "iske alawa", "kuch aur", "aur vacancy hai kya", "bas itna hi",
        "next job", "aur options", "dusri job", "more results", "baaki batao", "aur dikhao",
        "list badhao", "koi aur batao", "second option", "teesra option", "aur available hai kya"
    ],
    EXPLAIN_LAST_FAILURE: [
        "kyu nahi mili", "kyu nahi aaya", "nahi mila kyu", "aisa kyu", "reason batao",
        "failed kyu hua", "dikkat kya hai", "kyu nahi dikha raha", "data kyu nahi mila",
        "kya problem hai", "kyu nahi mil raha", "reason kya hai", "aisa kyu hua",
        "mila nahi kyu", "search kyu fail hua", "koi result nahi kyu"
    ],
    FIELD_DETAILS: [
        "fees?", "age?", "salary?", "eligibility?", "last date?", "link?", "apply kaise kare?",
        "paise kitne lagenge", "umar kitni chahiye", "vetan kya hai", "qualification kya hai",
        "aakhri tarikh", "registration link", "kaise apply kare", "fee kitni hai", "form fees",
        "last date batao", "official link do", "apply link bhejo", "age limit batao",
        "documents kya lagenge", "selection kaise hoga", "syllabus kya hai", "salary batao",
        "exam date", "notification pdf", "website do", "post details", "vacancy details"
    ],
    APPLICATION_HELP: [
        "form bharna hai", "apply kaise kare", "registration kaise karu", "online form bhar do",
        "form bharne me help", "apply wali help", "application process", "form kaise bhare",
        "link do apply karna hai", "apply karna hai", "online apply", "awedan kaise kare",
        "aavedan process", "form submit kaise kare", "registration steps", "apply steps batao",
        "online registration", "apply online batao", "form bharwa do", "application ka tarika"
    ],
    RESUME: [
        "resume banao", "cv banao", "resume improve karo", "job ke liye resume chahiye",
        "biodata kaise banaye", "portfolio help", "resume format", "perfect resume",
        "resume check karo", "cv improve", "resume kaise likhu", "fresher resume",
        "resume summary", "experience kaise likhu", "skills resume me kya dale"
    ],
    CAREER_GUIDANCE: [
        "career batao", "12th ke baad kya karu", "graduation ke baad kya", "future option batao",
        "mujhe settle hona hai", "career banana hai", "kaunsa course achha hai", "future planning",
        "earning ke liye kya karu", "paise kamane ke liye kya karu", "life me kya karu",
        "mere liye best option", "career option batao", "12th ke baad option", "graduate ke baad kya",
        "job ya course kya karu", "future secure kaise karu", "settle kaise hou", "income kaise banau",
        "skill kaunsi seekhu", "roadmap do", "career guidance chahiye", "kaam seekhna hai",
        "government me career", "private ya sarkari kya karu", "earning source batao"
    ],
    SCHOLARSHIP: [
        "scholarship batao", "padhai ke liye paisa", "student yojana", "fee support",
        "wazifa check", "scholarship kab aayegi", "chatravriti", "padhai ka kharcha",
        "fees bharne ke liye help", "student ke liye paisa", "education loan nahi scholarship",
        "fee refund", "scholarship form", "scholarship apply", "student scheme"
    ],
    RESULT_ADMIT_CARD: [
        "result kab aayega", "admit card download", "roll number", "cut off kitna gaya",
        "answer key dikhao", "merit list", "pariksha parinaam", "hall ticket", "exam city",
        "admit card kab", "score card", "cutoff", "result check", "answer key challenge"
    ],
    CONFIRMATION: [
        "yes", "haan", "ha", "ji", "ok", "okay", "theek", "thik", "sahi", "bilkul",
        "confirm", "done", "agree", "ji haan", "ha bhai", "yes bro", "kar do", "batao"
    ],
    NEGATION: [
        "no", "nahi", "na", "nhi", "cancel", "stop", "rehne do", "mat karo",
        "matlab nahi", "chhodo", "abhi nahi", "nahi chahiye", "skip"
    ],
    PROVIDE_QUALIFICATION: [
        "graduate", "12th pass", "10th pass", "iti", "diploma", "btech", "ba", "bsc", "bcom",
        "post graduate", "masters", "intermediate", "high school", "degree hai", "graduation hai",
        "m.a.", "mcom", "polytechnic", "computer certificate", "i am graduate"
    ]
};

const INTENT_METADATA = {
    GREETING: { domainIntent: 'NONE' },
    JOB_QUERY: { domainIntent: 'GOVT_JOB' },
    MORE_RESULTS: { domainIntent: 'GOVT_JOB' },
    EXPLAIN_LAST_FAILURE: { domainIntent: 'GENERAL' },
    FIELD_DETAILS: { domainIntent: 'GOVT_JOB' },
    APPLICATION_HELP: { domainIntent: 'GOVT_JOB' },
    RESUME: { domainIntent: 'RESUME' },
    CAREER_GUIDANCE: { domainIntent: 'CAREER' },
    SCHOLARSHIP: { domainIntent: 'SCHOLARSHIP' },
    RESULT_ADMIT_CARD: { domainIntent: 'RESULT_ADMIT_CARD' },
    CONFIRMATION: { domainIntent: 'GENERAL' },
    NEGATION: { domainIntent: 'GENERAL' },
    PROVIDE_QUALIFICATION: { domainIntent: 'GOVT_JOB' }
};

class IntentExampleRegistry {
    static getExamples(intent) { return INTENT_EXAMPLES[intent] || []; }
    static getAllIntents() { return Object.keys(INTENT_EXAMPLES); }
    static getRegistry() { return INTENT_EXAMPLES; }
    static getMetadata(intent) { return INTENT_METADATA[intent] || { domainIntent: 'GENERAL' }; }
}

module.exports = IntentExampleRegistry;
