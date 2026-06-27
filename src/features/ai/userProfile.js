/**
 * UserProfile Module
 * Responsibility: Normalize and manage user data.
 */
class UserProfile {
    /**
     * Normalizes user data into a structured profile object.
     */
    static format(data) {
        return {
            name: data.name || "User",
            qualification: data.qual || data.qualification || null,
            dob: data.dob || null,
            age: data.age || null,
            state: data.loc || data.state || null,
            category: data.cat || data.category || null,
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
}

module.exports = UserProfile;
