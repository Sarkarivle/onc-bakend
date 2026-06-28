const IntentDetector = require('./intentDetector');

const baseState = {
    topic: 'GENERAL',
    currentTopic: 'GENERAL',
    currentDomain: 'GENERAL',
    lastDomain: 'GENERAL',
    lastAssistantIntent: 'GENERAL',
    lastAssistantQuestion: null,
    pendingAction: null,
    lastShownItems: [],
    lastShownJobs: [],
    lastFailureReason: null
};

async function classify(input, state = {}) {
    return IntentDetector.detectSemantic(input, { ...baseState, ...state }, {});
}

function assertIntent(name, result, expected) {
    const all = [result.primaryIntent, ...(result.secondaryIntents || [])];
    const ok = expected.some(intent => all.includes(intent));
    if (!ok) {
        throw new Error(`${name}: expected one of ${expected.join(', ')}, got ${result.primaryIntent} (${all.join(', ')})`);
    }
}

function assertField(name, result, field, expected) {
    const actual = result[field];
    const ok = Array.isArray(expected) ? expected.includes(actual) : actual === expected;
    if (!ok) {
        throw new Error(`${name}: expected ${field}=${Array.isArray(expected) ? expected.join('|') : expected}, got ${actual}`);
    }
}

async function runIntentTests() {
    const tests = [
        {
            name: 'pure greeting',
            input: 'hi kaise ho',
            expected: ['GREETING']
        },
        {
            name: 'greeting plus jobs',
            input: 'hi latest jobs batao',
            expected: ['JOB_QUERY']
        },
        {
            name: 'semantic work query',
            input: 'mere liye koi kaam hai kya',
            expected: ['JOB_QUERY', 'CAREER_GUIDANCE']
        },
        {
            name: 'earning guidance',
            input: 'paisa kamane ka rasta batao',
            expected: ['CAREER_GUIDANCE', 'JOB_QUERY']
        },
        {
            name: 'job more follow-up',
            input: '1 hi hai kya',
            state: { currentDomain: 'GOVT_JOB', topic: 'GOVT_JOB', lastShownJobs: ['NAEL Recruitment'] },
            expected: ['MORE_JOBS', 'MORE_RESULTS']
        },
        {
            name: 'scholarship more follow-up',
            input: 'aur hai kya',
            state: { currentDomain: 'SCHOLARSHIP', topic: 'SCHOLARSHIP', lastShownItems: ['UP Scholarship'] },
            expected: ['MORE_SCHOLARSHIPS']
        },
        {
            name: 'qualification answer',
            input: 'Graduate',
            state: { pendingAction: 'WAITING_FOR_QUALIFICATION', currentDomain: 'GOVT_JOB' },
            expected: ['PROVIDE_QUALIFICATION']
        },
        {
            name: 'job fee field',
            input: 'fees?',
            state: { currentDomain: 'GOVT_JOB', topic: 'GOVT_JOB', lastShownJobs: ['ISRO ISTRAC Recruitment'] },
            expected: ['JOB_FEE_DETAILS']
        },
        {
            name: 'college fee field',
            input: 'fees?',
            state: { currentDomain: 'COLLEGE', topic: 'COLLEGE', lastShownItems: ['Bareilly College'] },
            expected: ['COLLEGE_FEE', 'FIELD_DETAILS']
        },
        {
            name: 'explain failure',
            input: 'kyu nahi mili',
            state: { currentDomain: 'GOVT_JOB', topic: 'GOVT_JOB', lastFailureReason: 'NO_ACTIVE_VERIFIED_RECORD' },
            expected: ['EXPLAIN_LAST_FAILURE']
        },
        {
            name: 'settle career',
            input: 'mujhe settle hona hai',
            expected: ['CAREER_GUIDANCE']
        },
        {
            name: 'form query',
            input: 'form nikla hai kya',
            expected: ['APPLICATION_HELP', 'JOB_QUERY']
        },
        {
            name: 'full details confirmation',
            input: 'haan',
            state: { currentDomain: 'GOVT_JOB', topic: 'GOVT_JOB', pendingAction: 'WAITING_FOR_DETAILS_CONFIRMATION', lastShownJobs: ['NAEL Recruitment'] },
            expected: ['SHOW_FULL_DETAILS']
        },
        {
            name: 'resume improve',
            input: 'resume improve karo',
            expected: ['RESUME']
        },
        {
            name: 'typo job normalization',
            input: 'nokri batao',
            expected: ['JOB_QUERY']
        },
        {
            name: 'typo result normalization',
            input: 'reslt kab aayega',
            expected: ['RESULT_ADMIT_CARD']
        }
    ];

    for (const test of tests) {
        const result = await classify(test.input, test.state);
        assertIntent(test.name, result, test.expected);
        if (test.name === 'pure greeting') assertField(test.name, result, 'communicationAct', 'GREETING');
        if (test.name === 'greeting plus jobs' && !result.communicationActs.includes('GREETING')) {
            throw new Error(`${test.name}: expected GREETING act in communicationActs`);
        }
        if (test.name === 'job fee field') assertField(test.name, result, 'task', 'FEE');
        console.log(`OK ${test.name}: ${result.primaryIntent} (${result.confidence})`);
    }
}

if (require.main === module) {
    runIntentTests().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { runIntentTests };
