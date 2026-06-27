class UserProfile {
    /**
     * Normalizes user data into a structured profile.
     * Matches Phase 4 Pipeline: User Profile.
     */
    static format(userData) {
        if (!userData) return "General User";

        const profile = {
            name: userData.name || "User",
            location: userData.loc || "Bareilly, Uttar Pradesh",
            dob: userData.dob || "Not specified",
            category: userData.cat || "General",
            qualification: userData.qual || "Not specified",
            learningInsights: userData.insights || "None"
        };

        // Add derived context (e.g., age calculation if DOB is available)
        return profile;
    }

    /**
     * Converts profile object to a string for prompt injection.
     */
    static toString(profile) {
        if (typeof profile === 'string') return profile;
        return `Name: ${profile.name} | Location: ${profile.location} | Qual: ${profile.qualification} | Category: ${profile.category} | Insights: ${profile.learningInsights}`;
    }
}

module.exports = UserProfile;
