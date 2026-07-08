/**
 * OCR Tool
 * Responsibility: Extracting text from images/documents (marksheets, IDs).
 */
const axios = require('axios');

class OCRTool {
    /**
     * Extracts text from an image URL or base64.
     * Uses ocr.space FREE API (Default Key: K87878787888957)
     */
    static async read(imageUrl) {
        console.log("👁️ OCR: Processing image", imageUrl);
        try {
            // Free API Key for testing purposes (provided by ocr.space)
            const API_KEY = process.env.OCR_API_KEY || 'K87878787888957';

            // ocr.space API call
            const response = await axios.get(`https://api.ocr.space/parse/imageurl?apikey=${API_KEY}&url=${imageUrl}&language=eng&isOverlayRequired=false`);

            if (response.data && response.data.ParsedResults && response.data.ParsedResults[0]) {
                const text = response.data.ParsedResults[0].ParsedText;
                return {
                    success: true,
                    extracted_text: text,
                    metadata: { source: "ocr.space", confidence: "high" },
                    instruction: "Use this extracted text to verify details like Marks, Roll No, or DOB. If it's a marksheet, calculate percentages if asked."
                };
            }

            throw new Error(response.data.ErrorMessage || "Failed to parse image");
        } catch (error) {
            console.error("❌ OCR Error:", error.message);
            return {
                success: false,
                error: "Bhai, image read nahi ho pa rahi. Ek baar check karo link sahi hai ya photo saaf hai?"
            };
        }
    }
}

module.exports = OCRTool;
