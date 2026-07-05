/**
 * UnitConverter Utility
 * Handles Indian height measurements (Feet/Inches to CM).
 */
class UnitConverter {
    static heightToCM(val) {
        if (!val) return 0;
        const num = parseFloat(val);

        // If value is small (e.g. 5.2, 6.0), assume it's FEET
        if (num < 10) {
            const feet = Math.floor(num);
            const inches = Math.round((num - feet) * 10);
            const totalInches = (feet * 12) + inches;
            return Math.round(totalInches * 2.54);
        }

        // If value is large (e.g. 165, 170), assume it's already CM
        return Math.round(num);
    }
}

module.exports = UnitConverter;
