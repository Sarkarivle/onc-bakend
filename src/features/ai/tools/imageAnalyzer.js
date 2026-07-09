/**
 * Image Analyzer Tool
 * Responsibility: Processing images using Vision LLMs (like Llama 3.2 Vision)
 */
const axios = require('axios');
const LLMProvider = require('../generation/core_engine/llmProvider');
const constants = require('../../../config/constants');

class ImageAnalyzer {
    /**
     * Analyzes an image (Base64 or URL) using Vision model
     * @param {string} imageUrl - Base64 data URI or image URL
     * @param {string} userPrompt - Context/Instruction for analysis
     */
    static async analyze(imageUrl, userPrompt = "Bhai, is image ko details me analyze karo. Agar ye marksheet hai toh marks extract karo, agar job poster hai toh details batao.") {
        console.log("👁️ ImageAnalyzer: Processing image analysis...");
        try {
            const fullUrl = await LLMProvider.getBaseUrl();
            const headers = LLMProvider.getHeaders();
            const model = constants.AI_VISION_MODEL || "llama-3.2-11b-vision-preview";

            // Groq/OpenAI Vision Payload Structure
            const payload = {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: userPrompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageUrl // Groq supports data:image/jpeg;base64,...
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1024,
                temperature: 0.2
            };

            const response = await axios.post(fullUrl, payload, {
                headers: headers,
                timeout: 60000 // Vision tasks can take longer
            });

            if (response.data && response.data.choices && response.data.choices[0].message) {
                const result = response.data.choices[0].message.content;
                return {
                    success: true,
                    analysis: result,
                    metadata: {
                        model: model,
                        source: "Groq Vision",
                        tokens: response.data.usage?.total_tokens
                    }
                };
            }

            throw new Error("Empty response from vision model");
        } catch (error) {
            console.error("❌ Image Analysis Error:", error.response?.data || error.message);

            // Handle specific Groq errors if needed
            const errorMessage = error.response?.data?.error?.message || error.message;

            return {
                success: false,
                error: `Bhai, image analyze karne me thodi problem aayi: ${errorMessage}`,
                fallback: "Try using OCR tool if this persists."
            };
        }
    }
}

module.exports = ImageAnalyzer;
