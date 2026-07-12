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
            // Each part MUST be on a new line. We use double newlines to ensure it's not swallowed by code blocks.
            let md = `\n\n| Feature | ${headers.slice(1).join(' | ')} |\n`;
            md += `| :--- | ${headers.slice(1).map(() => ':---').join(' | ')} |\n`;

            rows.forEach(row => {
                md += `| ${row.join(' | ')} |\n`;
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
