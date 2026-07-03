/**
 * DateTool
 * Responsibility: Precise date calculations in Asia/Kolkata timezone with human-friendly Hinglish output.
 */
class DateTool {
    static getKolkataDate() {
        // Precise Kolkata Time
        const now = new Date();
        const kolkataTime = now.getTime() + (5.5 * 60 * 60 * 1000);
        return new Date(kolkataTime);
    }

    static parseDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        let cleanStr = dateStr.trim().toLowerCase().replace(/,/g, '');

        if (cleanStr === 'today') return this.getKolkataDate();
        if (cleanStr.includes('soon') || cleanStr === 'n/a' || cleanStr === '') return null;

        const months = {
            'jan':0, 'january':0, 'feb':1, 'february':1, 'mar':2, 'march':2,
            'apr':3, 'april':3, 'may':4, 'jun':5, 'june':5, 'jul':6, 'july':6,
            'aug':7, 'august':7, 'sep':8, 'september':8, 'oct':9, 'october':9,
            'nov':10, 'november':10, 'dec':11, 'december':11
        };

        try {
            // 1. Handle DD-Month-YYYY or DD Month YYYY (e.g., 20 July 2026 or 20-July-2026)
            const parts = cleanStr.split(/[\s-]/);
            if (parts.length >= 3) {
                let d, m, y;
                // Scenario: 20 July 2026
                if (!isNaN(parts[0]) && isNaN(parts[1])) {
                    d = parseInt(parts[0]);
                    m = months[parts[1].substring(0, 3)];
                    y = parseInt(parts[2]);
                }
                // Scenario: July 20 2026
                else if (isNaN(parts[0]) && !isNaN(parts[1])) {
                    m = months[parts[0].substring(0, 3)];
                    d = parseInt(parts[1]);
                    y = parseInt(parts[2]);
                }

                if (d !== undefined && m !== undefined && !isNaN(y)) {
                    // Normalize 2-digit year
                    if (y < 100) y += 2000;
                    return new Date(y, m, d);
                }
            }

            // 2. Handle DD/MM/YYYY
            if (cleanStr.includes('/')) {
                const parts = cleanStr.split('/');
                if (parts.length === 3) {
                    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            }

            // 3. Fallback to native Date
            const nativeDate = new Date(dateStr);
            if (!isNaN(nativeDate.getTime())) return nativeDate;

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

        if (diffDays === 0) return { text: "Aaj aakhri din hai", daysRemaining: 0, status: "today" };
        if (diffDays === 1) return { text: "Kal aakhri din h", daysRemaining: 1, status: "urgent" };

        if (diffDays > 30) {
            const months = Math.floor(diffDays / 30);
            const remainingDays = diffDays % 30;
            let text = `${months} maheene`;
            if (remainingDays > 0) text += ` aur ${remainingDays} din baki hain`;
            else text += " baki hain";
            return { text, daysRemaining: diffDays, status: "future" };
        }

        return {
            text: `${diffDays} din baki hain`,
            daysRemaining: diffDays,
            status: "future"
        };
    }
}

module.exports = DateTool;
