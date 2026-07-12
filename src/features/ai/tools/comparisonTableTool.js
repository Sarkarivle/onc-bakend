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
            // Flexible argument parsing (handle singular/plural and case sensitivity)
            const title = args.title || args.Heading || "Comparison Table";
            const headers = args.headers || args.header || args.columns || [];
            const rows = args.rows || args.data || [];

            if (!Array.isArray(headers) || headers.length === 0 || !Array.isArray(rows) || rows.length === 0) {
                console.warn("⚠️ Invalid arguments to ComparisonTableTool:", JSON.stringify(args));
                return { success: false, error: "Headers and rows (as arrays) are required." };
            }

            // Generate clean, strictly formatted Markdown Table for "Slide-to-Read" behavior
            // We use double newlines around it to ensure the UI parser detects it as a block.
            let md = `\n\n### ${title}\n\n`;

            // 1. Header Row
            md += `| ${headers.join(' | ')} |\n`;

            // 2. Separator Row (Mandatory for Markdown Tables)
            md += `| ${headers.map(() => '---').join(' | ')} |\n`;

            // 3. Data Rows
            rows.forEach(row => {
                // Ensure each row has the same number of columns as headers
                const sanitizedRow = Array.isArray(row) ? row : [String(row)];
                while (sanitizedRow.length < headers.length) sanitizedRow.push("-");
                md += `| ${sanitizedRow.slice(0, headers.length).join(' | ')} |\n`;
            });

            md += `\n\n`;

            console.log("✅ Professional Table Generated.");

            return {
                success: true,
                table_markdown: md, // The UI expects this key
                message: "Comparison table generated successfully."
            };
        } catch (error) {
            console.error("❌ ComparisonTableTool Error:", error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ComparisonTableTool;
