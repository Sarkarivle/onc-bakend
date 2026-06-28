/**
 * FollowUpResolver Module
 * Resolves vague/short messages using ConversationState.
 */
class FollowUpResolver {
    static resolve(query, state = {}, originalQuery = query) {
        const q = (query || "").toLowerCase().trim();
        const domain = state.currentDomain || state.lastDomain || state.topic || 'GENERAL';
        const hasContext = this._hasContext(state, domain);
        const lastItem = this._lastItem(state);
        const itemType = state.lastShownItemType === 'SINGLE'
            ? 'SINGLE'
            : (state.lastShownItemType === 'LIST' || state.lastShownJobs?.length || state.lastResultCount > 1 ? 'LIST' : 'NONE');

        const base = {
            resolvedQuery: query,
            intent: null,
            domainIntent: null,
            isFollowUp: false,
            referencedTopic: hasContext ? (state.currentTopic || state.topic || domain) : null,
            referencedItem: lastItem,
            entities: {}
        };

        if (!q) return base;

        const qualification = this._resolveQualification(originalQuery, q, state, base);
        if (qualification.intent) return qualification;

        const confirmation = this._resolveConfirmation(q, state, base);
        if (confirmation.intent) return confirmation;

        const failure = this._resolveFailureQuestion(q, state, base);
        if (failure.intent) return failure;

        const application = this._resolveApplicationHelp(q, domain, hasContext, lastItem, base);
        if (application.intent) return application;

        const numeric = this._resolveNumericReference(q, state, base);
        if (numeric.intent) return numeric;

        const more = this._resolveMoreResults(q, domain, hasContext, itemType, base);
        if (more.intent) return more;

        const field = this._resolveFieldDetails(q, domain, hasContext, lastItem, base);
        if (field.intent) return field;

        const generic = this._resolveGenericFollowUp(q, domain, hasContext, itemType, base);
        if (generic.intent) return generic;

        return base;
    }

    static _resolveQualification(original, q, state, base) {
        const qualificationRegex = /^(graduate|graduation|12th|12th pass|10th|10th pass|iti|diploma|btech|b tech|ba|bsc|bcom|post graduate|pg|masters|intermediate|high school)\b/i;
        const hasJobIntent = /\b(job|naukri|vacancy|bharti|form|apply|ke liye|konsi|kaunsi|dikhao|batao)\b/i.test(q);
        const hasPending = state.pendingAction === 'WAITING_FOR_QUALIFICATION' || state.lastAssistantQuestion === 'QUALIFICATION';

        if (!qualificationRegex.test(q)) return base;

        if (hasPending) {
            return {
                ...base,
                resolvedQuery: `User qualification is ${original}. Show matching jobs using this profile detail.`,
                intent: 'PROVIDE_QUALIFICATION',
                domainIntent: 'GOVT_JOB',
                isFollowUp: true,
                entities: { qualification: original.trim() }
            };
        }

        if (hasJobIntent) {
            return {
                ...base,
                resolvedQuery: original,
                intent: 'JOB_QUERY',
                domainIntent: 'GOVT_JOB',
                isFollowUp: false,
                entities: { qualification: original.trim() }
            };
        }

        return {
            ...base,
            resolvedQuery: original,
            intent: 'PROFILE_INFO',
            domainIntent: 'GENERAL',
            isFollowUp: false,
            needClarification: true,
            entities: { qualification: original.trim() }
        };
    }

    static _resolveConfirmation(q, state, base) {
        if (!/^(yes|haan|ha|ji|ok|okay|theek|thik|sahi|bilkul|yes do|ha do|kar do|batao|yes batao|theek hai)$/.test(q)) return base;

        const hasContext = this._hasContext(state);
        const hasPending = Boolean(state.pendingAction || state.lastAssistantQuestion);
        let intent = 'CONFIRMATION';
        let resolvedQuery = 'User confirmed.';

        if (hasPending && state.pendingAction === 'WAITING_FOR_DETAILS_CONFIRMATION') {
            intent = 'SHOW_FULL_DETAILS';
            resolvedQuery = `Show full details for ${this._lastItem(state) || state.currentTopic || 'the last shown item'}.`;
        } else if (hasContext) {
            resolvedQuery = `User confirmed. Proceed with the last suggested action or continue providing details for ${state.topic || 'the current topic'}.`;
        }

        return {
            ...base,
            resolvedQuery,
            intent,
            domainIntent: state.currentDomain || state.lastDomain || 'GENERAL',
            isFollowUp: hasContext
        };
    }

    static _resolveFailureQuestion(q, state, base) {
        if (!/(kyu|why).*(nahi|na).*(mila|mili|aaya|dikha)|reason batao|aisa kyu/.test(q)) return base;

        return {
            ...base,
            resolvedQuery: `Explain why the last verified data request failed for ${state.currentTopic || state.topic || 'the previous topic'}.`,
            intent: 'EXPLAIN_LAST_FAILURE',
            domainIntent: state.currentDomain || state.lastDomain || 'GENERAL',
            isFollowUp: this._hasContext(state, state.currentDomain || state.lastDomain),
            entities: { lastFailureReason: state.lastFailureReason || null }
        };
    }

    static _resolveApplicationHelp(q, domain, hasContext, lastItem, base) {
        if (!/\b(kaha se apply|apply kaise|kaise bhare|kaise bharein|kaise bharen|form kaise|registration kaise|fee kaise pay|apply|registration|form bhar)\b/.test(q)) return base;

        if (!hasContext && !/\b(job|vacancy|bharti|form|application)\b/.test(q)) return base;

        return {
            ...base,
            resolvedQuery: `Explain application process for ${lastItem || domain || 'the previous item'}.`,
            intent: 'APPLICATION_HELP',
            domainIntent: hasContext ? domain : 'GOVT_JOB',
            isFollowUp: hasContext,
            entities: { field: 'applyProcess' }
        };
    }

    static _resolveNumericReference(q, state, base) {
        const match = q.match(/(\d+)\s*(no|number|th|st|rd|nd|wala|item|job|position)/i) ||
                      q.match(/^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s*(wala|item|job|position)?$/i) ||
                      q.match(/^(\d+)$/);

        if (!match) return base;

        const lastItems = state.lastShownItems || state.lastShownJobs || [];
        if (lastItems.length === 0) return base;

        let index = -1;
        const numPart = match[1].toLowerCase();
        if (/\d+/.test(numPart)) {
            index = parseInt(numPart) - 1;
        } else {
            const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
            index = words.indexOf(numPart);
        }

        if (index >= 0 && index < lastItems.length) {
            const selectedItem = lastItems[index];
            let resolvedQuery = `Show details for ${selectedItem}.`;

            if (selectedItem.match(/(jhtet|tet|ctet|eligibility test|reet|uptet|entrance)/i)) {
                resolvedQuery = `Note: ${selectedItem} is an eligibility test, not a direct vacancy. Show its details and clarify that vacancy count may not apply.`;
            }

            return {
                ...base,
                resolvedQuery,
                intent: 'FIELD_DETAILS',
                domainIntent: state.currentDomain || state.lastDomain || 'GOVT_JOB',
                isFollowUp: true,
                referencedItem: selectedItem,
                entities: { itemIndex: index + 1, field: 'details' }
            };
        }

        return base;
    }

    static _resolveMoreResults(q, domain, hasContext, itemType, base) {
        if (!/^(aur jobs|aur hai kya|aur|aur batao|next|more|dusra option batao|dusra option|sirf ek hai kya|sirf itna hi|1 hi hai kya|bas itna hi|baaki batao|kuch aur)$/.test(q)) return base;
        if (!hasContext) return base;

        const intentByDomain = {
            GOVT_JOB: 'MORE_JOBS',
            RAILWAY_JOB: 'MORE_JOBS',
            BANK_JOB: 'MORE_JOBS',
            POLICE_JOB: 'MORE_JOBS',
            DEFENCE_JOB: 'MORE_JOBS',
            TEACHING_JOB: 'MORE_JOBS',
            HEALTH_JOB: 'MORE_JOBS',
            SCHOLARSHIP: 'MORE_SCHOLARSHIPS',
            COLLEGE: 'MORE_COLLEGES',
            CAREER: 'MORE_CAREER_OPTIONS',
            RESULT_ADMIT_CARD: 'MORE_RESULTS'
        };

        return {
            ...base,
            resolvedQuery: `Show more results for ${domain}.`,
            intent: intentByDomain[domain] || 'MORE_RESULTS',
            domainIntent: domain,
            isFollowUp: true,
            entities: { offset: base.nextOffset || null }
        };
    }

    static _resolveFieldDetails(q, domain, hasContext, lastItem, base) {
        const fieldMap = [
            ['fees', /\b(fee|fees|form fee|form fees|paise|charge|shulk)\b/],
            ['age', /\b(age|umar|umr|age limit|kitni age)\b/],
            ['salary', /\b(salary|vetan|pay scale|paisa kitna|income)\b/],
            ['eligibility', /\b(eligibility|qualification|yogyata|kaun bhar sakta)\b/],
            ['lastDate', /\b(last date|aakhri date|aakhri tarikh|last kab|date)\b/],
            ['officialLink', /\b(link|link do|official link|website|site|apply link)\b/],
            ['syllabus', /\b(syllabus|exam pattern|pattern)\b/],
            ['selection', /\b(selection|selection kaise|selection process|chayan)\b/],
            ['documents', /\b(document|documents|photo|signature|certificate)\b/],
            ['details', /\b(details|details dikhao|details do|more info|sahi se batao)\b/]
        ];

        for (const [field, regex] of fieldMap) {
            if (!regex.test(q)) continue;
            if (!hasContext) {
                return {
                    ...base,
                    intent: 'FIELD_DETAILS',
                    domainIntent: 'GENERAL',
                    isFollowUp: false,
                    needClarification: true,
                    entities: { field }
                };
            }

            return {
                ...base,
                resolvedQuery: `Tell ${field} details for ${lastItem || domain || 'the previous item'}.`,
                intent: this._fieldIntent(domain, field),
                domainIntent: domain,
                isFollowUp: true,
                entities: { field },
                referencedItem: lastItem
            };
        }

        return base;
    }

    static _resolveGenericFollowUp(q, domain, hasContext, itemType, base) {
        if (!/^(batao|batao na|sahi se batao|details|details do|details dikhao|more info)$/.test(q)) return base;

        if (!hasContext) {
            return {
                ...base,
                intent: 'GENERAL_QUERY',
                domainIntent: 'GENERAL',
                isFollowUp: false,
                needClarification: true
            };
        }

        const wantsMore = itemType === 'LIST' && /^(batao|batao na)$/.test(q);
        return {
            ...base,
            resolvedQuery: wantsMore ? `Show more results for ${domain}.` : `Show details for ${base.referencedItem || domain}.`,
            intent: wantsMore ? 'MORE_RESULTS' : 'FIELD_DETAILS',
            domainIntent: domain,
            isFollowUp: true,
            entities: { field: wantsMore ? 'moreResults' : 'details' }
        };
    }

    static _fieldIntent(domain, field) {
        if (domain === 'COLLEGE' && field === 'fees') return 'COLLEGE_FEE';
        if (domain === 'SCHOLARSHIP' && field === 'fees') return 'SCHOLARSHIP_AMOUNT_OR_ELIGIBILITY';
        if (domain === 'GOVT_JOB' && field === 'fees') return 'JOB_FEE_DETAILS';
        if (domain === 'GOVT_JOB' && field === 'age') return 'JOB_AGE_LIMIT';
        if (domain === 'GOVT_JOB' && field === 'officialLink') return 'JOB_LINK_DETAILS';
        if (field === 'details') return 'FIELD_DETAILS';
        return 'FIELD_DETAILS';
    }

    static _hasContext(state = {}, domain = 'GENERAL') {
        return Boolean(
            (domain && domain !== 'GENERAL') ||
            (state.currentTopic && state.currentTopic !== 'GENERAL') ||
            (Array.isArray(state.lastShownItems) && state.lastShownItems.length > 0) ||
            (Array.isArray(state.lastShownJobs) && state.lastShownJobs.length > 0)
        );
    }

    static _lastItem(state = {}) {
        if (Array.isArray(state.lastShownItems) && state.lastShownItems.length > 0) return state.lastShownItems[0];
        if (Array.isArray(state.lastShownJobs) && state.lastShownJobs.length > 0) return state.lastShownJobs[0];
        return state.currentTopic && state.currentTopic !== 'GENERAL' ? state.currentTopic : null;
    }
}

module.exports = FollowUpResolver;
