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
            console.log(`Total active jobs in DB: ${allJobs.length}`);

            let eligibleJobsCount = 0;
            let eligibleGrantsCount = 0;
            let urgentCount = 0;

            const now = new Date();
            const fiveDaysFromNow = new Date();
            fiveDaysFromNow.setDate(now.getDate() + 5);

            for (const item of allJobs) {
                const report = await EligibilityEngine.evaluate(userProfile, item, { skipLLM: true });

                if (report.status === 'ELIGIBLE') {
                    const category = (item.category || "").toLowerCase();
                    const title = (item.title || "").toLowerCase();
                    const isGrant = /scheme|scholarship|yojna|grant|pension/i.test(category + title);

                    if (isGrant) {
                        eligibleGrantsCount++;
                    } else {
                        eligibleJobsCount++;
                    }

                    // Deadline logic: if lastDate is within 5 days
                    if (item.lastDate) {
                        const lastDate = new Date(item.lastDate);
                        if (lastDate >= now && lastDate <= fiveDaysFromNow) {
                            urgentCount++;
                        }
                    }
                }
            }

            // 2. PLANS (Count user goals/plans from memory)
            // Broader search to pick up more memories
            const memories = await MemoryEngine.searchMemory(userProfile.name, 'plan goal career target sapna naukri aim', 50);

            const plansCount = memories.filter(m =>
                ['GOAL', 'PLAN', 'CAREER_GOAL', 'TARGET'].includes(m.category) ||
                /(plan|sapna|target|aim|goal|naukri)/i.test(m.fact)
            ).length;

            console.log(`Final Dashboard Stats -> Jobs: ${eligibleJobsCount}, Grants: ${eligibleGrantsCount}, Plans: ${plansCount}, Urgent: ${urgentCount}`);

            return {
                success: true,
                stats: {
                    jobs: eligibleJobsCount || 0,
                    grants: eligibleGrantsCount || 0,
                    plans: plansCount || 0,
                    urgent: urgentCount || 0
                },
                message: `Bhai, tere liye abhi ${eligibleJobsCount} Jobs aur ${eligibleGrantsCount} Schemes fit hain.`
            };
        } catch (error) {
            console.error("❌ DashboardTool Error:", error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = DashboardTool;
