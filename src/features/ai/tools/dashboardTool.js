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
        console.log(`📊 DashboardTool: Fetching stats for ${userProfile?.name} (ID: ${userProfile?._id})`);
        try {
            // 1. ALL ACTIVE JOBS (Inclusive query to handle legacy data without isActive field)
            const allJobs = await Job.find({
                $or: [
                    { isActive: true },
                    { isActive: { $exists: false } }
                ]
            }).lean();

            console.log(`- Total jobs found in DB: ${allJobs.length}`);

            let eligibleJobsCount = 0;
            let eligibleGrantsCount = 0;
            let urgentCount = 0;
            let ineligibleCount = 0;
            let incompleteCount = 0;

            if (allJobs.length > 0) {
                const now = new Date();
                const fiveDaysFromNow = new Date();
                fiveDaysFromNow.setDate(now.getDate() + 5);

                for (const item of allJobs) {
                    try {
                        const report = await EligibilityEngine.evaluate(userProfile, item, { skipLLM: true });

                        if (report.status === 'ELIGIBLE' || report.status === 'INCOMPLETE_PROFILE') {
                            if (report.status === 'INCOMPLETE_PROFILE') incompleteCount++;

                            const category = (item.category || "").toLowerCase();
                            const title = (item.title || "").toLowerCase();

                            // Improved Grant/Scheme detection (Supporting both English and Hindi/Transliterated)
                            const isGrant = /scheme|scholarship|yojna|yojana|grant|pension|subsidy|beema|bima|card|result|योजना|छात्रवृत्ति|अनुदान|पेंशन|बीमा/i.test(category + title);

                            if (isGrant) {
                                eligibleGrantsCount++;
                            } else {
                                eligibleJobsCount++;
                            }

                            // Deadline logic
                            let jobDeadline = item.lastDate ? new Date(item.lastDate) : null;
                            if (!jobDeadline && item.importantDates?.applicationLastDate) {
                                // Try to parse string date if Date object is missing
                                const parsed = new Date(item.importantDates.applicationLastDate);
                                if (!isNaN(parsed.getTime())) jobDeadline = parsed;
                            }

                            if (jobDeadline) {
                                if (jobDeadline >= now && jobDeadline <= fiveDaysFromNow) {
                                    urgentCount++;
                                }
                            }
                        } else {
                            ineligibleCount++;
                        }
                    } catch (e) {
                        console.error(`  - Error evaluating job ${item.title}:`, e.message);
                    }
                }
            }

            // 2. PLANS (Count user goals/plans from memory)
            let plansCount = 0;
            try {
                // Fix: Use userId instead of name for memory search
                const searchId = userProfile._id ? userProfile._id.toString() : userProfile.id;
                let memories = await MemoryEngine.searchMemory(searchId, 'plan goal career target sapna naukri aim', 50);

                // Fallback to name if ID search failed and name is not generic
                if ((!memories || memories.length === 0) && userProfile.name && !userProfile.name.includes('User')) {
                    const nameMemories = await MemoryEngine.searchMemory(userProfile.name, 'plan goal career target sapna naukri aim', 50);
                    if (nameMemories.length > 0) memories = nameMemories;
                }

                plansCount = (memories || []).filter(m =>
                    ['GOAL', 'PLAN', 'CAREER_GOAL', 'TARGET'].includes(m.category) ||
                    /(plan|sapna|target|aim|goal|naukri)/i.test(m.fact)
                ).length;
            } catch (memErr) {
                console.error("  - Memory Search Error in Dashboard:", memErr.message);
            }

            console.log(`✅ Stats Calculated -> Jobs: ${eligibleJobsCount}, Grants: ${eligibleGrantsCount}, Plans: ${plansCount}, Urgent: ${urgentCount}`);

            return {
                success: true,
                stats: {
                    jobs: eligibleJobsCount,
                    grants: eligibleGrantsCount,
                    plans: plansCount,
                    urgent: urgentCount,
                    debug: {
                        totalInDb: allJobs.length,
                        ineligible: ineligibleCount,
                        incomplete: incompleteCount
                    }
                },
                message: `Bhai, tere liye abhi ${eligibleJobsCount + eligibleGrantsCount} matches hain.`
            };
        } catch (error) {
            console.error("❌ DashboardTool Error:", error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = DashboardTool;
