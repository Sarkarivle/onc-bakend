/**
 * FollowUpResolver Module
 * Responsibility: Resolve short/vague follow-ups using ConversationState.
 */
class FollowUpResolver {
    static resolve(query, state = {}, originalQuery = query) {
        const q = (query || "").toLowerCase().trim();
        const domain = state.currentDomain || state.lastDomain || state.topic || 'GENERAL';
        const hasContext = domain && domain !== 'GENERAL';
        const lastItem = this._lastItem(state);

        const result = {
            resolvedQuery: query,
            intent: null,
            domainIntent: null,
            isFollowUp: false,
            referencedTopic: hasContext ? domain : null,
            referencedItem: lastItem,
            entities: {}
        };

        if (!q) return result;

        const pending = this._resolvePendingAnswer(originalQuery, q, state, result);
        if (pending.isFollowUp) return pending;

        const failure = this._resolveFailureQuestion(q, state, result);
        if (failure.isFollowUp) return failure;

        const more = this._resolveMoreResults(q, domain, result);
        if (more.isFollowUp) return more;

        const confirmation = this._resolveConfirmation(q, state, result);
        if (confirmation.isFollowUp) return confirmation;

        const field = this._resolveFieldDetails(q, domain, lastItem, result);
        if (field.isFollowUp) return field;

        return result;
    }

    static _resolvePendingAnswer(original, q, state, base) {
        const qualificationOnly = /^(graduate|graduation|12th|12th pass|10th|10th pass|iti|diploma|btech|ba|bsc|bcom|post graduate|pg|masters|intermediate|high school)\b/i;

        if (state.pendingAction === 'WAITING_FOR_QUALIFICATION' || qualificationOnly.test(q)) {
            return {
                ...base,
                resolvedQuery: `User qualification is ${original}. Show matching jobs using this profile detail.`,
                intent: 'PROVIDE_QUALIFICATION',
                domainIntent: 'GOVT_JOB',
                isFollowUp: true,
                entities: { qualification: original.trim() }
            };
        }

        if (state.pendingAction === 'WAITING_FOR_DOB' && /\d{4}|\d{1,2}[/-]\d{1,2}/.test(q)) {
            return {
                ...base,
                resolvedQuery: `User date of birth is ${original}.`,
                intent: 'PROVIDE_DOB',
                domainIntent: state.currentDomain || 'GOVT_JOB',
                isFollowUp: true,
                entities: { dob: original.trim() }
            };
        }

        return base;
    }

    static _resolveFailureQuestion(q, state, base) {
        if (/(kyu|why).*(nahi|na).*(mila|mili|aaya|dikha)|reason batao|aisa kyu/.test(q)) {
            return {
                ...base,
                resolvedQuery: `Explain why the last verified data request failed for ${state.currentTopic || state.topic || 'the previous topic'}.`,
                intent: 'EXPLAIN_LAST_FAILURE',
                domainIntent: state.currentDomain || state.lastDomain || 'GENERAL',
                isFollowUp: true,
                entities: { lastFailureReason: state.lastFailureReason || null }
            };
        }

        return base;
    }

    static _resolveMoreResults(q, domain, base) {
        if (/^(aur hai kya|aur|aur batao|next|more|more jobs|dusra option|sirf itna hi|1 hi hai kya|bas itna hi|baaki batao|kuch aur)$/.test(q)) {
            const intentByDomain = {
                GOVT_JOB: 'MORE_JOBS',
                SCHOLARSHIP: 'MORE_SCHOLARSHIPS',
                COLLEGE: 'MORE_COLLEGES',
                CAREER: 'MORE_CAREER_OPTIONS',
                RESULT_ADMIT_CARD: 'MORE_RESULTS'
            };
            const resolvedIntent = intentByDomain[domain] || 'MORE_RESULTS';

            return {
                ...base,
                resolvedQuery: `Show more results for ${domain}.`,
                intent: resolvedIntent,
                domainIntent: domain === 'GENERAL' ? 'GOVT_JOB' : domain,
                isFollowUp: true,
                entities: { offset: base.nextOffset || null }
            };
        }

        return base;
    }

    static _resolveConfirmation(q, state, base) {
        if (/^(yes|haan|ha|ji|ok|okay|theek|thik|sahi|bilkul|kar do|batao)$/.test(q)) {
            let intent = 'CONFIRMATION';
            let resolvedQuery = `Yes, continue with ${state.currentTopic || state.topic || 'the previous topic'}.`;

            if (state.pendingAction === 'WAITING_FOR_DETAILS_CONFIRMATION') {
                intent = 'SHOW_FULL_DETAILS';
                resolvedQuery = `Show full details for ${this._lastItem(state) || state.currentTopic || 'the last shown item'}.`;
            }

            return {
                ...base,
                resolvedQuery,
                intent,
                domainIntent: state.currentDomain || state.lastDomain || 'GENERAL',
                isFollowUp: true
            };
        }

        return base;
    }

    static _resolveFieldDetails(q, domain, lastItem, base) {
        const fieldMap = [
            ['fees', /\b(fee|fees|form fee|form fees|paise|charge|shulk)\b/],
            ['age', /\b(age|umar|umr|age limit|kitni age)\b/],
            ['salary', /\b(salary|vetan|pay scale|paisa kitna|income)\b/],
            ['eligibility', /\b(eligibility|qualification|yogyata|kaun bhar sakta)\b/],
            ['lastDate', /\b(last date|aakhri date|last kab|date)\b/],
            ['officialLink', /\b(link|official link|website|site|apply link)\b/],
            ['applyProcess', /\b(apply kaise kare|apply|form kaise bhare|registration)\b/],
            ['documents', /\b(document|documents|photo|signature|certificate)\b/]
        ];

        for (const [field, regex] of fieldMap) {
            if (!regex.test(q)) continue;

            const intent = this._fieldIntent(domain, field);
            return {
                ...base,
                resolvedQuery: `Tell ${field} details for ${lastItem || domain || 'the previous item'}.`,
                intent,
                domainIntent: domain === 'GENERAL' ? 'GOVT_JOB' : domain,
                isFollowUp: true,
                entities: { field },
                referencedItem: lastItem
            };
        }

        return base;
    }

    static _fieldIntent(domain, field) {
        if (domain === 'COLLEGE' && field === 'fees') return 'COLLEGE_FEE';
        if (domain === 'SCHOLARSHIP' && field === 'fees') return 'SCHOLARSHIP_AMOUNT_OR_ELIGIBILITY';
        if (domain === 'GOVT_JOB' && field === 'fees') return 'JOB_FEE_DETAILS';
        if (domain === 'GOVT_JOB' && field === 'age') return 'JOB_AGE_LIMIT';
        if (domain === 'GOVT_JOB' && field === 'officialLink') return 'JOB_LINK_DETAILS';
        if (domain === 'GOVT_JOB' && field === 'applyProcess') return 'APPLICATION_HELP';
        return 'FIELD_DETAILS';
    }

    static _lastItem(state = {}) {
        if (Array.isArray(state.lastShownItems) && state.lastShownItems.length > 0) {
            return state.lastShownItems[0];
        }
        if (Array.isArray(state.lastShownJobs) && state.lastShownJobs.length > 0) {
            return state.lastShownJobs[0];
        }
        return state.currentTopic && state.currentTopic !== 'GENERAL' ? state.currentTopic : null;
    }
}

module.exports = FollowUpResolver;
