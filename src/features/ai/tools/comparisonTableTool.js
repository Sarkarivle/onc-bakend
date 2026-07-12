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

            // High-precision Markdown Table for Mobile Grid Rendering
            // Double newlines and strictly isolated lines ensure the UI parser detects it as a table block.
            let md = `\n\n### ${title}\n\n`;

            // 1. Header Row
            md += `| ${headers.map(h => String(h).trim()).join(' | ')} |\n`;

            // 2. Strict Separator Row (Mandatory)
            md += `| ${headers.map(() => '---').join(' | ')} |\n`;

            // 3. Data Rows
            rows.forEach(row => {
                const sanitizedRow = Array.isArray(row) ? row : [String(row)];
                const cells = sanitizedRow.map(c => String(c).trim().replace(/\|/g, '\\|')); // Escape pipes
                while (cells.length < headers.length) cells.push("-");
                md += `| ${cells.slice(0, headers.length).join(' | ')} |\n`;
            });

            md += `\n\n`;

            console.log("✅ High-Precision Table Generated.");

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
