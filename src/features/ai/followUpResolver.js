/**
 * FollowUpResolver Module
 * Resolves vague/short messages using ConversationState.
 * Build a reusable follow-up decision layer.
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
            usePreviousContext: false,
            selectedItemIndex: null,
            followUpType: 'UNKNOWN',
            referencedTopic: hasContext ? (state.currentTopic || state.topic || domain) : null,
            referencedItem: lastItem,
            entities: {}
        };

        if (!q) return base;

        // 1. New Topic Check (Context Reset Gate)
        if (this._isNewTopic(q)) {
            return base;
        }

        // 2. Resolver Chain
        const qualification = this._resolveQualification(originalQuery, q, state, base);
        if (qualification.intent) return qualification;

        const confirmation = this._resolveConfirmation(q, state, base, itemType);
        if (confirmation.intent) return confirmation;

        const failure = this._resolveFailureQuestion(q, state, base);
        if (failure.intent) return failure;

        const numeric = this._resolveNumericReference(q, state, base);
        if (numeric.intent) return numeric;

        const application = this._resolveApplicationHelp(q, domain, hasContext, lastItem, base);
        if (application.intent) return application;

        const more = this._resolveMoreResults(q, domain, hasContext, itemType, state, base);
        if (more.intent) return more;

        const field = this._resolveFieldDetails(q, domain, hasContext, lastItem, base);
        if (field.intent) return field;

        const generic = this._resolveGenericFollowUp(q, domain, hasContext, itemType, base);
        if (generic.intent) return generic;

        // 3. Heuristic Context detection for short reference phrases
        if (hasContext && this._isFollowUpPhrase(q)) {
            return {
                ...base,
                isFollowUp: true,
                usePreviousContext: true,
                followUpType: 'DETAILS',
                intent: 'FIELD_DETAILS'
            };
        }

        return base;
    }

    static _isNewTopic(q) {
        const newTopicRegex = /\b(doctor|mbbs|nursing|medical|police kaise bane|teacher kaise bane|engineer kaise bane|career|12th ke baad|10th ke baad|graduation ke baad|course|diploma|iti ke baad|mujhe .* banna hai|bpsc cutoff|ssc cgl|upsc cse|rrb ntpc|scholarship query|resume query|new job|nayi naukri)\b/i;
        return newTopicRegex.test(q);
    }

    static _isFollowUpPhrase(q) {
        const referenceWords = /\b(ye|iski|iske|us|uski|uske|vo|wali|wala|upar wali|niche wali|pichhli|last wali|ye wali|yes|haan|ha|ji|ok|theek)\b/i;
        return (q.length < 25 && referenceWords.test(q)) || /^(details|batao|dikhao|sahi se|pura|aur|more)$/i.test(q);
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
                usePreviousContext: true,
                followUpType: 'DETAILS',
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

    static _resolveConfirmation(q, state, base, itemType) {
        const confirmationRegex = /^(yes|haan|ha|ji|ok|okay|theek|thik|sahi|bilkul|yes do|ha do|kar do|yes batao|theek hai|theek batao|haan batao|batao|ok batao|ji batao)$/;
        if (!confirmationRegex.test(q)) return base;

        const hasContext = this._hasContext(state);
        const lastItem = base.referencedItem;
        const lastItems = state.lastShownItems || state.lastShownJobs || [];
        const assistantMsg = (state.lastAssistantQuestion || state.lastAssistantMsg || "").toLowerCase();
        const offeredDetails = assistantMsg.includes('detail') || assistantMsg.includes('apply') || assistantMsg.includes('fees') || assistantMsg.includes('link') || assistantMsg.includes('eligibility') || assistantMsg.includes('process');

        // Optimization: If user says 'batao' on a list without a specific offer, let _resolveGenericFollowUp handle it (usually MORE_RESULTS)
        if (q === 'batao' && itemType === 'LIST' && !offeredDetails) {
            return base;
        }

        const hasPending = Boolean(state.pendingAction || state.lastAssistantQuestion);
        let intent = 'CONFIRMATION';
        let resolvedQuery = 'User confirmed.';
        let needClarification = false;

        if (hasPending && state.pendingAction === 'WAITING_FOR_DETAILS_CONFIRMATION') {
            intent = 'SHOW_FULL_DETAILS';
            resolvedQuery = `Show full details for ${lastItem || state.currentTopic || 'the last shown item'}.`;
        } else if (hasContext) {
            // Case: Exactly one item or explicitly marked as single
            if (lastItems.length === 1 || (itemType === 'SINGLE' && lastItem)) {
                intent = 'FIELD_DETAILS';
                resolvedQuery = `Show full details for ${lastItem}.`;
            }
            // Case: Multiple items exist
            else if (lastItems.length > 1) {
                if (state.selectedItemIndex) {
                    intent = 'FIELD_DETAILS';
                    resolvedQuery = `Show full details for ${lastItems[state.selectedItemIndex - 1]}.`;
                } else if (offeredDetails) {
                    // Requirement: ask for number if multiple items exist and user just says "yes"
                    needClarification = true;
                    resolvedQuery = "Kaunsi job ke details chahiye? 1, 2, 3 number bata dijiye.";
                } else {
                    resolvedQuery = `User confirmed. Proceed with the last suggested action or continue providing details for ${state.topic || 'the current topic'}.`;
                }
            } else if (lastItem) {
                // Fallback for context with topic but no item list
                intent = 'FIELD_DETAILS';
                resolvedQuery = `Show full details for ${lastItem}.`;
            }
        } else {
            // Case 7: If previous context does not exist, ask clarification instead of guessing.
            needClarification = true;
            resolvedQuery = "User confirmed but no previous context found.";
        }

        return {
            ...base,
            resolvedQuery,
            intent,
            domainIntent: state.currentDomain || state.lastDomain || 'GENERAL',
            isFollowUp: hasContext,
            usePreviousContext: hasContext,
            followUpType: 'DETAILS',
            needClarification,
            referencedItem: lastItem
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
            usePreviousContext: true,
            followUpType: 'DETAILS',
            entities: { lastFailureReason: state.lastFailureReason || null }
        };
    }

    static _resolveApplicationHelp(q, domain, hasContext, lastItem, base) {
        if (!/\b(kaha se apply|apply kaise|kaise bhare|kaise bharein|kaise bharen|form kaise|registration kaise|fee kaise pay|apply|registration|form bhar|bharna hai)\b/.test(q)) return base;

        if (!hasContext && !/\b(job|vacancy|bharti|form|application)\b/.test(q)) return base;

        return {
            ...base,
            resolvedQuery: `Explain how to apply for ${lastItem || domain || 'the previous item'}.`,
            intent: 'APPLICATION_HELP',
            domainIntent: hasContext ? domain : 'GOVT_JOB',
            isFollowUp: hasContext,
            usePreviousContext: hasContext,
            followUpType: 'APPLY',
            entities: { field: 'applyProcess' }
        };
    }

    static _resolveNumericReference(q, state, base) {
        const match = q.match(/(\d+)\s*(no|number|th|st|rd|nd|wala|item|job|position|vaale|wali|waali)/i) ||
                      q.match(/^(first|second|third|fourth|chouthi|fifth|sixth|seventh|eighth|ninth|tenth)\s*(wala|item|job|position)?$/i) ||
                      q.match(/^(\d+)$/) ||
                      q.match(/(upar|niche|pichhli|last|first)\s*(wali|waali|wala|vaale|job|no)/i);

        if (!match) return base;

        const lastItems = state.lastShownItems || state.lastShownJobs || [];
        if (lastItems.length === 0) return base;

        let index = -1;
        const fullMatch = match[0].toLowerCase();
        const numPart = (match[1] || "").toLowerCase();

        if (fullMatch.includes('first') || fullMatch.includes('upar')) index = 0;
        else if (fullMatch.includes('second')) index = 1;
        else if (fullMatch.includes('third')) index = 2;
        else if (fullMatch.includes('fourth') || fullMatch.includes('chouthi')) index = 3;
        else if (fullMatch.includes('fifth')) index = 4;
        else if (/\d+/.test(numPart)) {
            index = parseInt(numPart) - 1;
        } else if (/\d+/.test(fullMatch)) {
            const val = parseInt(fullMatch);
            if (val > 20) return base;
            index = val - 1;
        }

        if (index >= 0 && index < lastItems.length) {
            const selectedItem = lastItems[index];
            let resolvedQuery = `Show details for ${selectedItem}.`;

            if (String(selectedItem).match(/(jhtet|tet|ctet|eligibility test|reet|uptet|entrance)/i)) {
                resolvedQuery = `Note: ${selectedItem} is an eligibility test, not a direct vacancy. Show its details and clarify that vacancy count may not apply.`;
            }

            return {
                ...base,
                resolvedQuery,
                intent: 'FIELD_DETAILS',
                domainIntent: state.currentDomain || state.lastDomain || 'GOVT_JOB',
                isFollowUp: true,
                usePreviousContext: true,
                selectedItemIndex: index + 1,
                followUpType: 'DETAILS',
                referencedItem: selectedItem,
                entities: { itemIndex: index + 1, field: 'details' }
            };
        }

        // If index is invalid but it was a clear numeric attempt
        if (/\d+/.test(numPart) || /\d+/.test(fullMatch)) {
            return {
                ...base,
                intent: 'FIELD_DETAILS',
                needClarification: true,
                isFollowUp: true,
                usePreviousContext: true,
                followUpType: 'UNKNOWN'
            };
        }

        return base;
    }

    static _resolveMoreResults(q, domain, hasContext, itemType, state, base) {
        if (!/^(aur jobs|aur hai kya|aur|aur batao|next|more|dusra option batao|dusra option|sirf ek hai kya|sirf itna hi|1 hi hai kya|bas itna hi|baaki batao|kuch aur|aur dikhao)$/.test(q)) return base;
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
            usePreviousContext: true,
            followUpType: 'MORE_RESULTS',
            entities: { offset: state.nextOffset || null }
        };
    }

    static _resolveFieldDetails(q, domain, hasContext, lastItem, base) {
        const fieldMap = [
            ['FEES', /\b(fee|fees|form fee|form fees|paise|charge|shulk|kitna paisa)\b/, 'FIELD_DETAILS'],
            ['ELIGIBILITY', /\b(eligibility|qualification|yogyata|kaun bhar sakta|kaun apply|criteria)\b/, 'FIELD_DETAILS'],
            ['AGE', /\b(age|umar|umr|age limit|kitni age|aayu)\b/, 'FIELD_DETAILS'],
            ['DATE', /\b(last date|aakhri date|aakhri tarikh|last kab|kab tak|closing date|date)\b/, 'FIELD_DETAILS'],
            ['LINK', /\b(link|link do|official link|website|site|apply link|notification link)\b/, 'FIELD_DETAILS'],
            ['SYLLABUS', /\b(syllabus|exam pattern|pattern|subjects|kya aayega)\b/, 'FIELD_DETAILS'],
            ['SELECTION', /\b(selection|selection kaise|selection process|chayan|kaise hoga selection)\b/, 'FIELD_DETAILS'],
            ['SALARY', /\b(salary|vetan|pay scale|paisa kitna|income|paisa kitna milega)\b/, 'FIELD_DETAILS'],
            ['DOCUMENTS', /\b(document|documents|photo|signature|certificate|kagaj)\b/, 'FIELD_DETAILS'],
            ['DETAILS', /\b(details|details dikhao|details do|more info|sahi se batao|pura batao|jankari|jaankari)\b/, 'FIELD_DETAILS']
        ];

        for (const [type, regex, fallbackIntent] of fieldMap) {
            if (!regex.test(q)) continue;

            const field = type.toLowerCase();
            if (!hasContext) {
                return {
                    ...base,
                    intent: 'FIELD_DETAILS',
                    domainIntent: 'GENERAL',
                    isFollowUp: false,
                    needClarification: true,
                    followUpType: type,
                    entities: { field }
                };
            }

            return {
                ...base,
                resolvedQuery: `Tell ${field} details for ${lastItem || domain || 'the previous item'}.`,
                intent: 'FIELD_DETAILS',
                domainIntent: domain,
                isFollowUp: true,
                usePreviousContext: true,
                followUpType: type,
                entities: { field },
                referencedItem: lastItem
            };
        }

        return base;
    }

    static _resolveGenericFollowUp(q, domain, hasContext, itemType, base) {
        if (!/^(batao|batao na|sahi se batao|details|details do|details dikhao|more info|aur batao)$/.test(q)) return base;

        if (!hasContext) {
            return {
                ...base,
                intent: 'GENERAL_QUERY',
                domainIntent: 'GENERAL',
                isFollowUp: false,
                needClarification: true
            };
        }

        const wantsMore = itemType === 'LIST' && /^(batao|batao na|aur batao)$/.test(q);
        return {
            ...base,
            resolvedQuery: wantsMore ? `Show more results for ${domain}.` : `Show details for ${base.referencedItem || domain}.`,
            intent: wantsMore ? 'MORE_RESULTS' : 'FIELD_DETAILS',
            domainIntent: domain,
            isFollowUp: true,
            usePreviousContext: true,
            followUpType: wantsMore ? 'MORE_RESULTS' : 'DETAILS',
            entities: { field: wantsMore ? 'moreResults' : 'details' }
        };
    }

    static _fieldIntent(domain, field) {
        if (domain === 'COLLEGE' && field === 'fees') return 'COLLEGE_FEE';
        if (domain === 'SCHOLARSHIP' && field === 'fees') return 'SCHOLARSHIP_AMOUNT_OR_ELIGIBILITY';
        if (domain === 'GOVT_JOB' && field === 'fees') return 'JOB_FEE_DETAILS';
        if (domain === 'GOVT_JOB' && field === 'age') return 'JOB_AGE_LIMIT';
        if (domain === 'GOVT_JOB' && field === 'officiallink') return 'JOB_LINK_DETAILS';
        if (field === 'details') return 'FIELD_DETAILS';
        return null;
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
