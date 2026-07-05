/**
 * AgeCalculator Utility
 * High-precision math for Government Job Cutoffs.
 */
class AgeCalculator {
    static calculate(dobInput, refInput = new Date()) {
        try {
            if (!dobInput) throw new Error("DOB_MISSING");

            const dob = new Date(dobInput);
            const ref = new Date(refInput);

            if (isNaN(dob.getTime()) || isNaN(ref.getTime())) throw new Error("INVALID_DATE");

            dob.setHours(0, 0, 0, 0);
            ref.setHours(0, 0, 0, 0);

            if (dob > ref) throw new Error("FUTURE_DOB");

            let years = ref.getFullYear() - dob.getFullYear();
            let months = ref.getMonth() - dob.getMonth();
            let days = ref.getDate() - dob.getDate();

            if (days < 0) {
                months--;
                const prevMonthLastDay = new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
                days += prevMonthLastDay;
            }

            if (months < 0) {
                years--;
                months += 12;
            }

            const isLeapBaby = dob.getMonth() === 1 && dob.getDate() === 29;

            // Indian Date Format: DD-MM-YYYY
            const formatDate = (date) => {
                const d = String(date.getDate()).padStart(2, '0');
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const y = date.getFullYear();
                return `${d}-${m}-${y}`;
            };

            return {
                success: true,
                data: {
                    years,
                    months,
                    days,
                    formatted: `${years}y ${months}m ${days}d`,
                    is_leap_baby: isLeapBaby,
                    as_on_date: formatDate(ref)
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }
}

module.exports = AgeCalculator;
