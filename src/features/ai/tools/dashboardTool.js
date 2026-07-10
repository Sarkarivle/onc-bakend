/**
 * DashboardTool Module
 * Responsibility: Calculating real-time stats for the user's dashboard hero card.
 */
const Job = require('../../jobs/jobModel');
const EligibilityEngine = require('../../eligibility/EligibilityEngine');
const MemoryEngine = require('../memory/memoryEngine');

class DashboardTool {
    /**
     * Calculates personalized counts for Jobs, Grants, and Plans.
     */
    static async getStats(userProfile) {
        console.log(`📊 DashboardTool: Calculating real-time matches for ${userProfile.name}`);
        try {
            // 1. ALL ACTIVE JOBS
            const allJobs = await Job.find({ isActive: true }).lean();

            let eligibleJobsCount = 0;
            let eligibleGrantsCount = 0;

            for (const item of allJobs) {
                const report = await EligibilityEngine.evaluate(userProfile, item, { skipLLM: true });
                if (report.status === 'ELIGIBLE') {
                    // Check if it's a regular job or a grant/scheme
                    const isGrant = /scheme|scholarship|yojna|grant/i.test((item.category || "") + (item.title || ""));
                    if (isGrant) {
                        eligibleGrantsCount++;
                    } else {
                        eligibleJobsCount++;
                    }
                }
            }

            // 2. PLANS (Count user goals/plans from memory)
            const memories = await MemoryEngine.searchMemory(userProfile.name, 'plan goal career', 20);
            const plansCount = memories.filter(m =>
                ['GOAL', 'PLAN', 'CAREER_GOAL'].includes(m.category) ||
                m.fact.toLowerCase().includes('plan')
            ).length;

            return {
                success: true,
                stats: {
                    jobs: eligibleJobsCount,
                    grants: eligibleGrantsCount,
                    plans: plansCount
                },
                message: `Bhai, tere liye abhi ${eligibleJobsCount} Jobs, ${eligibleGrantsCount} Grants aur ${plansCount} Career Plans bilkul fit hain.`
            };
        } catch (error) {
            console.error("❌ DashboardTool Error:", error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = DashboardTool;
