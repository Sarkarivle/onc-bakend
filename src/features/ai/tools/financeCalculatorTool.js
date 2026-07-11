/**
 * Finance Calculator Tool (EMI & Interest)
 * Responsibility: Calculate loan EMIs, interest rates, and repayment plans for students.
 */

class FinanceCalculatorTool {
    static calculateEMI(amount, rate, tenureYears) {
        try {
            const monthlyRate = rate / (12 * 100);
            const tenureMonths = tenureYears * 12;

            const emi = (amount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
                        (Math.pow(1 + monthlyRate, tenureMonths) - 1);

            const totalPayment = emi * tenureMonths;
            const totalInterest = totalPayment - amount;

            return {
                success: true,
                message: "Bhai, tera loan calculation ready hai.",
                monthly_emi: Math.round(emi),
                total_interest: Math.round(totalInterest),
                total_payment: Math.round(totalPayment),
                advice: "Bhai, kam tenure lega toh interest kam dena padega, par EMI thodi badh jayegi."
            };
        } catch (error) {
            console.error("❌ Finance Calculator Error:", error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = FinanceCalculatorTool;
