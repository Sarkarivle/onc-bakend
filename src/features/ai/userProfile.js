/**
 * UserProfile Module
 * Responsibility: Normalize and manage user data.
 */
class UserProfile {
    /**
     * Fetches user profile from DB and formats it.
     */
    static async get(userName, sessionData = {}) {
        const User = require('../auth/userModel');
        let dbUser = null;

        if (userName && userName !== 'User') {
            dbUser = await User.findOne({ name: userName }).lean();
        }

        return {
            name: userName || "User",
            qualification: sessionData.qualification || dbUser?.education || null,
            dob: sessionData.dob || dbUser?.dob || null,
            state: sessionData.state || dbUser?.domicileState || null,
            category: sessionData.category || dbUser?.category || null,
            gender: sessionData.gender || dbUser?.gender || null,
            city: sessionData.city || dbUser?.city || null,
            isNewUser: !dbUser,
            insights: dbUser ? `Previous user. Known qualification: ${dbUser.education || 'Unknown'}` : "New user."
        };
    }

    /**
     * Normalizes user data into a structured profile object (Legacy/Internal).
     */
    static format(data) {
        return {
            name: data.userName || data.name || "User",
            qualification: data.userQualification || data.qual || data.qualification || null,
            dob: data.userDOB || data.dob || null,
            age: data.userAge || data.age || null,
            state: data.userLocation || data.loc || data.state || null,
            category: data.userCategory || data.cat || data.category || null,
            gender: data.gender || null,
            goal: data.goal || null,
            insights: data.insights || ""
        };
    }

    /**
     * Identifies which fields are missing from the profile.
     */
    static getMissingFields(profile) {
        const required = ['qualification', 'dob', 'state', 'category'];
        return required.filter(field => !profile[field]);
    }

    /**
     * Converts profile to a natural language summary for the AI.
     */
    static toContextString(profile) {
        const parts = [];
        if (profile.qualification) parts.push(`Qualification: ${profile.qualification}`);
        if (profile.dob) parts.push(`DOB: ${profile.dob}`);
        if (profile.state) parts.push(`Location: ${profile.state}`);
        if (profile.category) parts.push(`Category: ${profile.category}`);

        return parts.length > 0 ? parts.join(" | ") : "User Profile is currently empty.";
    }

    /**
     * Syncs profile info to the User database model.
     */
    static async syncToDb(userName, profileUpdates) {
        const User = require('../auth/userModel');
        if (!userName || userName === 'User' || !profileUpdates) return;

        const updateData = {};
        if (profileUpdates.qualification) updateData.education = profileUpdates.qualification;
        if (profileUpdates.state) updateData.domicileState = profileUpdates.state;
        if (profileUpdates.category) updateData.category = profileUpdates.category;
        if (profileUpdates.dob) updateData.dob = profileUpdates.dob;
        if (profileUpdates.gender) updateData.gender = profileUpdates.gender;

        if (Object.keys(updateData).length === 0) return;

        try {
            // Try matching by name (this is a simple fallback, phone is better but might not be in session)
            await User.findOneAndUpdate({ name: userName }, updateData, { new: true });
        } catch (e) {
            console.error("Profile sync error:", e.message);
        }
    }
}

module.exports = UserProfile;
