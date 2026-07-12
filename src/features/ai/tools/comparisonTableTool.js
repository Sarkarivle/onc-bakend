/**
 * ComparisonTableTool Module
 * Responsibility: Generating professional, scrollable Markdown tables.
 */

class ComparisonTableTool {
    /**
     * Generates a Markdown table string from headers and rows.
     */
    static async generate(args) {
        try {
            const { title, headers, rows } = args;

            if (!headers || !rows || !Array.isArray(headers) || !Array.isArray(rows)) {
                throw new Error("Headers and rows (as arrays) are required for table generation.");
            }

            // Generate high-quality HTML Table for "Real Table" look
            let html = `\n\n### ${title}\n\n`;
            html += `<div style="overflow-x:auto;">\n`;
            html += `<table style="width:100%; border-collapse: collapse; margin: 10px 0; font-family: sans-serif; min-width: 300px; border: 1px solid #dddddd;">\n`;

            // Header
            html += `  <thead>\n`;
            html += `    <tr style="background-color: #009879; color: #ffffff; text-align: left;">\n`;
            headers.forEach(h => {
                html += `      <th style="padding: 12px 15px; border: 1px solid #dddddd;">${h}</th>\n`;
            });
            html += `    </tr>\n`;
            html += `  </thead>\n`;

            // Body
            html += `  <tbody>\n`;
            rows.forEach((row, index) => {
                const bgColor = index % 2 === 0 ? '#f3f3f3' : '#ffffff';
                html += `    <tr style="background-color: ${bgColor};">\n`;
                row.forEach(cell => {
                    html += `      <td style="padding: 12px 15px; border: 1px solid #dddddd;">${cell}</td>\n`;
                });
                html += `    </tr>\n`;
            });
            html += `  </tbody>\n`;
            html += `</table>\n`;
            html += `</div>\n\n`;

            return {
                success: true,
                table_markdown: html, // The UI expects this key
                message: "Professional HTML table generated successfully."
            };
        } catch (error) {
            console.error("❌ ComparisonTableTool Error:", error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ComparisonTableTool;
