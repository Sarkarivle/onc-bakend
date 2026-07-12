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

            if (!headers || !rows) {
                throw new Error("Headers and rows are required for table generation.");
            }

            let md = `\n\n### ${title}\n\n`;

            // Header Row
            md += `| ${headers.join(' | ')} |\n`;

            // Separator Row (Left Aligned for better mobile reading)
            md += `| ${headers.map(() => ':---').join(' | ')} |\n`;

            // Data Rows
            rows.forEach(row => {
                md += `| ${row.join(' | ')} |\n`;
            });

            md += `\n\n`;

            return {
                success: true,
                table_markdown: md,
                message: "Table generated successfully."
            };
        } catch (error) {
            console.error("❌ ComparisonTableTool Error:", error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ComparisonTableTool;
