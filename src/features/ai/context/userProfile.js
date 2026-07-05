/**
 * UserProfile Module
 * Responsibility: Normalize and manage user data.
 */
class UserProfile {
    static async get(userName, sessionData = {}) {
        const User = require('../../auth/userModel');
        let dbUser = null;

        if (User.db?.readyState === 1 && userName && userName !== 'User') {
            dbUser = await User.findOne({ name: userName }).lean();
        }

        return {
            name: userName || "User",
            // Priority 1: Auth DB (Source of Truth)
            education: dbUser?.education || dbUser?.educationLevel || sessionData.userQualification || null,
            qualification: dbUser?.education || dbUser?.educationLevel || sessionData.userQualification || null,
            stream: dbUser?.educationStream || null,
            percentage: dbUser?.educationPercentage || null,
            professionalDegrees: dbUser?.professionalDegrees || [],

            dob: dbUser?.dob || sessionData.userDOB || null,
            state: dbUser?.domicileState || sessionData.userLocation || null,
            category: dbUser?.category || sessionData.userCategory || null,
            gender: dbUser?.gender || sessionData.gender || null,
            city: dbUser?.city || sessionData.city || null,

            // Physical
            height: dbUser?.height || null,
            weight: dbUser?.weight || null,
            chest: dbUser?.chest || null,
            vision: dbUser?.vision || null,

            // Skills & Special
            certificates: dbUser?.certificates || [],
            typing: dbUser?.typingSkills || [],
            steno: dbUser?.stenoSkill || false,
            license: dbUser?.drivingLicense || 'None',
            ncc: dbUser?.nccCertificate || 'None',
            sports: dbUser?.sportsLevel || 'None',

            // Status
            maritalStatus: dbUser?.maritalStatus || 'Single',
            serviceStatus: dbUser?.serviceStatus || 'Fresh',
            serviceYears: dbUser?.serviceYears || 0,

            isNewUser: !dbUser,
            insights: dbUser ? `Known qualification: ${dbUser.education || 'Unknown'}` : "New user."
        };
    }

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

    static getMissingFields(profile) {
        const required = ['qualification', 'dob', 'state', 'category'];
        return required.filter(field => !profile[field]);
    }

    static toContextString(profile) {
        const parts = [];
        if (profile.qualification) parts.push(`Qualification: ${profile.qualification}`);
        if (profile.dob) parts.push(`DOB: ${profile.dob}`);
        if (profile.state) parts.push(`Location: ${profile.state}`);
        if (profile.category) parts.push(`Category: ${profile.category}`);

        return parts.length > 0 ? parts.join(" | ") : "User Profile is currently empty.";
    }

    static async syncToDb(userName, profileUpdates) {
        const User = require('../../auth/userModel');
        if (!userName || userName === 'User' || !profileUpdates) return;
        if (User.db?.readyState !== 1) return;

        // Fetch current data to avoid overwriting authoritative profile with AI extraction guesses
        const existing = await User.findOne({ name: userName }).select('education domicileState category dob gender').lean();

        const updateData = {};

        // Normalize qualification to match Flutter App Dropdown values
        if (profileUpdates.qualification) {
            let q = String(profileUpdates.qualification).toLowerCase();
            if (q.includes('12')) profileUpdates.qualification = '12th Pass';
            else if (q.includes('10')) profileUpdates.qualification = '10th Pass';
            else if (q.includes('grad')) profileUpdates.qualification = 'Graduate';
            else if (q.includes('post grad')) profileUpdates.qualification = 'Post Graduate';
            else if (q.includes('iti') || q.includes('diploma')) profileUpdates.qualification = 'ITI/Diploma';
        }

        // Only sync from AI if the field is currently empty in the database.
        // This preserves the "Source of Truth" as requested.
        if (profileUpdates.qualification && !existing?.education) updateData.education = profileUpdates.qualification;
        if (profileUpdates.state && !existing?.domicileState) updateData.domicileState = profileUpdates.state;
        if (profileUpdates.category && !existing?.category) updateData.category = profileUpdates.category;
        if (profileUpdates.dob && !existing?.dob) updateData.dob = profileUpdates.dob;
        if (profileUpdates.gender && !existing?.gender) updateData.gender = profileUpdates.gender;

        if (Object.keys(updateData).length === 0) return;

        try {
            await User.findOneAndUpdate({ name: userName }, updateData, { new: true });
        } catch (e) {
            console.error("Profile sync error:", e.message);
        }
    }
}

module.exports = UserProfile;
