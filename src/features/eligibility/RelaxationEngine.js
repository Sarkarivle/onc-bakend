/**
 * RelaxationEngine
 * Applying category-based modifications to base constraints.
 */
class RelaxationEngine {
    static resolve(user, jobPolicies = [], constraintKey) {
        if (!user || !jobPolicies || !Array.isArray(jobPolicies)) return 0;

        const userTags = this._getUserTags(user);
        const activePolicies = jobPolicies.filter(p =>
            p.constraint === constraintKey &&
            userTags.includes(p.category?.toUpperCase())
        );

        if (activePolicies.length === 0) return 0;

        const strategy = (jobPolicies.meta?.merging_strategy || 'MAX_ONLY').toUpperCase();
        const validPolicies = activePolicies.filter(p => this._isConditionMet(user, p));

        if (validPolicies.length === 0) return 0;

        if (strategy === 'CUMULATIVE') {
            return validPolicies.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
        } else {
            return Math.max(...validPolicies.map(p => Number(p.value) || 0));
        }
    }

    static _getUserTags(user) {
        const tags = [];
        if (user.category) tags.push(user.category.toUpperCase());
        if (user.gender) tags.push(user.gender.toUpperCase());
        if (user.is_pwbd || user.is_ph) tags.push('PWBD');
        if (user.is_ex_serviceman || user.service_history?.is_ex_sm) tags.push('EX_SERVICEMAN');
        if (user.is_govt_employee) tags.push('GOVT_EMPLOYEE');
        if (user.is_agniveer) tags.push('AGNIVEER');
        if (user.marital_status === 'WIDOW') tags.push('WIDOW');
        if (user.marital_status === 'DIVORCEE') tags.push('DIVORCEE');
        if (user.is_sports_quota) tags.push('SPORTS_QUOTA');
        if (user.domicileState) tags.push(`DOMICILE_${user.domicileState.toUpperCase().replace(/\s+/g, '_')}`);
        return tags;
    }

    static _isConditionMet(user, policy) {
        if (!policy.condition) return true;
        const { key, value, operator = '==' } = policy.condition;
        const userValue = user.service_history?.[key] || user[key];
        switch (operator) {
            case '>=': return userValue >= value;
            case '<=': return userValue <= value;
            case '>': return userValue > value;
            case '<': return userValue < value;
            default: return userValue == value;
        }
    }
}

module.exports = RelaxationEngine;
