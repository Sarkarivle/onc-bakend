/**
 * DateTool
 * Responsibility: Precise date calculations in Asia/Kolkata timezone with human-friendly Hinglish output.
 */
class DateTool {
    static getKolkataDate() {
        return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    }

    static parseDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const cleanStr = dateStr.trim().toLowerCase();

        if (cleanStr === 'today') return this.getKolkataDate();
        if (cleanStr.includes('soon') || cleanStr === 'n/a' || cleanStr === '') return null;

        try {
            // Handle DD/MM/YYYY
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanStr)) {
                const [d, m, y] = cleanStr.split('/');
                return new Date(y, m - 1, d);
            }

            // Handle DD-Month-YYYY (e.g., 21-Apr-2026)
            if (cleanStr.includes('-')) {
                const parts = cleanStr.split('-');
                if (parts.length === 3) {
                    const months = { 'jan':0, 'feb':1, 'mar':2, 'apr':3, 'may':4, 'jun':5, 'jul':6, 'aug':7, 'sep':8, 'oct':9, 'nov':10, 'dec':11 };
                    const m = months[parts[1].substring(0,3)];
                    if (m !== undefined) {
                        return new Date(parseInt(parts[2]), m, parseInt(parts[0]));
                    }
                }
            }

            // Handle DD Month YYYY (e.g., 21 April 2026)
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) return d;

            return null;
        } catch (e) {
            return null;
        }
    }

    static calculateUrgency(targetDateStr) {
        const targetDate = this.parseDate(targetDateStr);
        const today = this.getKolkataDate();
        today.setHours(0, 0, 0, 0);

        if (!targetDate) {
            return {
                text: "Date abhi aayi nhi h",
                daysRemaining: null,
                status: "upcoming"
            };
        }

        targetDate.setHours(0, 0, 0, 0);
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                text: "Date nikal chuki h",
                daysRemaining: diffDays,
                status: "expired"
            };
        }

        if (diffDays === 0) {
            return {
                text: "Aaj aakhri din hai",
                daysRemaining: 0,
                status: "today"
            };
        }

        if (diffDays === 1) {
            return {
                text: "Kal aakhri din h (1 din baki)",
                daysRemaining: 1,
                status: "urgent"
            };
        }

        if (diffDays > 30) {
            const months = Math.floor(diffDays / 30);
            const remainingDays = diffDays % 30;
            let text = `${months} maheene`;
            if (remainingDays > 0) text += ` aur ${remainingDays} din baki hain`;
            else text += " baki hain";

            return {
                text,
                daysRemaining: diffDays,
                status: "future"
            };
        }

        return {
            text: `${diffDays} din baki hain`,
            daysRemaining: diffDays,
            status: "future"
        };
    }
}

module.exports = DateTool;
