/**
 * DateTool - Extreme Version
 * Responsibility: Parse ANY date format and calculate remaining days in IST.
 */
class DateTool {
    static getKolkataDate() {
        const now = new Date();
        const kolkataTime = now.getTime() + (5.5 * 60 * 60 * 1000);
        return new Date(kolkataTime);
    }

    static parseDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        let cleanStr = dateStr.trim().toLowerCase().replace(/[^a-z0-9\/\-\s]/g, '');

        if (cleanStr.includes('soon') || cleanStr === 'na' || cleanStr === '') return null;

        const months = {
            'jan':0, 'feb':1, 'mar':2, 'apr':3, 'may':4, 'jun':5, 'jul':6, 'aug':7, 'sep':8, 'oct':9, 'nov':10, 'dec':11,
            'january':0, 'february':1, 'march':2, 'april':3, 'may':4, 'june':5, 'july':6, 'august':7, 'september':8, 'october':9, 'november':10, 'december':11
        };

        try {
            // Match pattern like "20 July 2026" or "20-07-2026"
            const dayMatch = cleanStr.match(/(\d{1,2})[\s\-\/]([a-z]+|\d{1,2})[\s\-\/](\d{2,4})/);
            if (dayMatch) {
                let d = parseInt(dayMatch[1]);
                let mPart = dayMatch[2];
                let y = parseInt(dayMatch[3]);
                if (y < 100) y += 2000;

                let m;
                if (isNaN(mPart)) {
                    m = months[mPart.substring(0, 3)];
                } else {
                    m = parseInt(mPart) - 1;
                }

                if (m !== undefined && !isNaN(y)) return new Date(y, m, d);
            }

            const nativeDate = new Date(dateStr);
            if (!isNaN(nativeDate.getTime())) return nativeDate;
            return null;
        } catch (e) { return null; }
    }

    static calculateUrgency(targetDateStr) {
        const targetDate = this.parseDate(targetDateStr);
        const today = this.getKolkataDate();
        today.setHours(0, 0, 0, 0);

        if (!targetDate) return { text: "Date abhi aayi nhi h", status: "upcoming" };

        targetDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: "Date nikal chuki h", status: "expired" };
        if (diffDays === 0) return { text: "Aaj aakhri din hai!", status: "today" };
        if (diffDays === 1) return { text: "Kal aakhri din h", status: "urgent" };

        if (diffDays > 30) {
            const m = Math.floor(diffDays / 30);
            const d = diffDays % 30;
            return { text: `${m} mahine ${d > 0 ? 'aur ' + d + ' din' : ''} baki hain`, status: "future" };
        }
        return { text: `${diffDays} din baki hain`, status: "future" };
    }
}
module.exports = DateTool;
