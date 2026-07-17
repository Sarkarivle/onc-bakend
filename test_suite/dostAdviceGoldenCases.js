/**
 * Golden set for the "Dost Advice" LLM prompt (expert_reasoning.js).
 * Run via `npm run test:dost-advice` BEFORE deploying any prompt change to
 * catch regressions - e.g. the bug where hard disqualifiers (wrong education,
 * height below minimum) were phrased as "chhota sa maamla" like they were
 * still fixable, misleading users into thinking they could still apply.
 *
 * Each case is intentionally unambiguous about what the engine SHOULD find,
 * so the deterministic assertions in runDostAdviceEval.js catch structural
 * regressions automatically. Tone/wording correctness (does a hard_blocker
 * actually read as disqualifying?) is still a human judgment call - the
 * runner prints full text for that.
 */

const baseJob = (overrides = {}) => ({
    title: 'Sub Inspector (SI) Recruitment 2026',
    cutoff_date: '2026-01-01',
    base_constraints: {
        age: { min: 21, max: 27 },
        education: { level: 'GRADUATE' },
        physical: { male: { GENERAL: { height: 168 } }, female: { GENERAL: { height: 152 } } },
    },
    relaxations: [{ category: 'OBC', constraint: 'MAX_AGE', value: 3 }],
    ...overrides,
});

module.exports = [
    {
        name: 'hard_fail_education_and_height',
        description: 'User fails BOTH a hard constraint (education below GRADUATE) and height. Response must not soften these as minor/fixable.',
        expectHardBlockers: true,
        user: {
            name: 'Himanshu', dob: '2000-01-01', gender: 'MALE', category: 'GENERAL',
            education: '12TH PASS', height: '157', domicileState: 'UP',
        },
        job: baseJob(),
    },
    {
        name: 'soft_gap_domicile_only',
        description: 'User passes age/education/height, only fails a soft constraint (domicile). Softer tone here is correct.',
        expectHardBlockers: false,
        user: {
            name: 'Priya', dob: '1999-06-15', gender: 'FEMALE', category: 'GENERAL',
            education: 'GRADUATE', height: '160', domicileState: 'UP',
        },
        job: baseJob({ base_constraints: { age: { min: 21, max: 27 }, education: { level: 'GRADUATE' }, physical: { female: { GENERAL: { height: 152 } } }, domicile: { state: 'PUNJAB' } } }),
    },
    {
        name: 'fully_eligible',
        description: 'Everything matches - response should be confidently positive, no hedging.',
        expectHardBlockers: false,
        user: {
            name: 'Rohit', dob: '2001-03-10', gender: 'MALE', category: 'GENERAL',
            education: 'GRADUATE', height: '175', domicileState: 'UP',
        },
        job: baseJob(),
    },
    {
        name: 'hard_fail_age_only',
        description: 'User is outside the age window (a hard constraint) but otherwise a perfect match.',
        expectHardBlockers: true,
        user: {
            name: 'Suresh', dob: '1985-01-01', gender: 'MALE', category: 'GENERAL',
            education: 'GRADUATE', height: '175', domicileState: 'UP',
        },
        job: baseJob(),
    },
];
