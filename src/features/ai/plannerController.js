const PlannerLog = require('./models/PlannerLog');
const fs = require('fs');

class PlannerController {
    // 1. Get all logs for the dashboard
    static async getLogs(req, res) {
        try {
            const logs = await PlannerLog.find().sort({ createdAt: -1 }).limit(100);
            res.json({ success: true, logs });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // 2. Correct a log entry
    static async correctLog(req, res) {
        try {
            const { id } = req.params;
            const { correctedPlan } = req.body;
            const updated = await PlannerLog.findByIdAndUpdate(id, {
                correctedPlan,
                status: 'reviewed'
            }, { new: true });
            res.json({ success: true, updated });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // 3. Export for Fine-tuning (JSONL format)
    static async exportData(req, res) {
        try {
            const reviewedLogs = await PlannerLog.find({ status: 'reviewed' });

            // Format for Fine-tuning: {"instruction": "query", "input": "", "output": "correctedPlan JSON"}
            const dataset = reviewedLogs.map(log => ({
                instruction: "Analyze the user request and return a valid JSON execution plan.",
                input: log.query,
                output: JSON.stringify(log.correctedPlan || log.originalPlan)
            }));

            const jsonl = dataset.map(d => JSON.stringify(d)).join('\n');
            const filePath = `./planner_training_data_${Date.now()}.jsonl`;

            fs.writeFileSync(filePath, jsonl);
            res.download(filePath);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = PlannerController;
