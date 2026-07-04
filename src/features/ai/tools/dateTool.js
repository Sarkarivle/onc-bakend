/**
 * DateTool - Upgraded Version
 * Responsibility: Parse ANY date format and calculate remaining days in IST.
 * Synced with Flutter JobDateHelper logic.
 */
class DateTool {
    static getKolkataDate() {
        const now = new Date();
        const kolkataTime = now.getTime() + (5.5 * 60 * 60 * 1000);
        return new Date(kolkataTime);
    }

    static parseDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string' || dateStr === 'N/A' || dateStr.toLowerCase() === 'na') return null;

        let cleanStr = dateStr.trim().toLowerCase();

        try {
            // 1. Handle Month Names like "12 May 2026"
            const wordDateRegex = /(\d{1,2})[\s\-]+([a-z]{3,10})[\s\-]+(\d{4})/;
            const wordMatch = cleanStr.match(wordDateRegex);

            if (wordMatch) {
                const day = wordMatch[1].padStart(2, '0');
                const monthName = wordMatch[2];
                const year = wordMatch[3];

                const monthsMap = {
                    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
                    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
                    'january': '01', 'february': '02', 'march': '03', 'april': '04', 'june': '06',
                    'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
                };

                let monthNum = monthsMap[monthName] || (monthName.length > 3 ? monthsMap[monthName.substring(0, 3)] : null);
                if (monthNum) {
                    return new Date(`${year}-${monthNum}-${day}T00:00:00Z`);
                }
            }

            // 2. Handle Numeric Formats like "12-05-2026", "12/05/2026", "12.05.26"
            let numericStr = cleanStr.replace(/[^0-9\-\/\.]/g, ' ').replace(/\s+/g, ' ').trim();
            if (numericStr.includes('-') || numericStr.includes('/') || numericStr.includes('.')) {
                const sep = numericStr.includes('-') ? '-' : (numericStr.includes('/') ? '/' : '.');
                const parts = numericStr.split(sep);
                if (parts.length === 3) {
                    let p1 = parts[0].trim(), p2 = parts[1].trim(), p3 = parts[2].trim();
                    let year = p3.length === 2 ? "20" + p3 : p3;
                    let month = p2.padStart(2, '0'), day = p1.padStart(2, '0');

                    // Handle YYYY-MM-DD
                    if (p1.length === 4) {
                        year = p1;
                        day = p3.padStart(2, '0');
                    }

                    const d = new Date(`${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
                    if (!isNaN(d.getTime())) return d;
                }
            }

            // 3. Native Fallback
            const nativeDate = new Date(dateStr);
            if (!isNaN(nativeDate.getTime())) return nativeDate;

            return null;
        } catch (e) { return null; }
    }

    static calculateUrgency(targetDateStr) {
        if (!targetDateStr || targetDateStr === 'N/A') {
            return { text: "Check Details", status: "unknown", daysLeft: null };
        }

        const targetDate = this.parseDate(targetDateStr);
        const today = this.getKolkataDate();
        today.setUTCHours(0, 0, 0, 0);

        if (!targetDate) {
            return { text: targetDateStr, status: "unknown", daysLeft: null };
        }

        targetDate.setUTCHours(0, 0, 0, 0);
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: "Expired", status: "expired", daysLeft: diffDays };
        if (diffDays === 0) return { text: "Last Day!", status: "urgent", daysLeft: 0 };

        const status = diffDays <= 3 ? "urgent" : "future";
        return {
            text: `${diffDays} days left`,
            status: status,
            daysLeft: diffDays
        };
    }
}

module.exports = DateTool;
