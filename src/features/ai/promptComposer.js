const registry = require('./moduleRegistry');

class PromptComposer {
    static build(intents, userData, liveData, currentDate, currentYear) {
        let prompt = "# ACTIVE DIRECTIVES:\n";

        intents.forEach(intent => {
            if (registry[intent]) {
                prompt += `\n[${intent} MODULE]:\n${registry[intent]}\n`;
            }
        });

        prompt += `\n# USER CONTEXT:\n${registry.CONTEXT(
            userData.name,
            userData.loc,
            userData.dob,
            userData.cat,
            userData.qual,
            userData.insights,
            currentDate,
            currentYear
        )}`;
        prompt += `\n\n# LIVE DATA:\n${liveData.jobs}\n${liveData.kendras}\n${liveData.web || ""}`;

        prompt += `\n\nBEGIN NEURAL PROCESSING. OPEN <HIDDEN_MATH>:`;
        return prompt;
    }
}

module.exports = PromptComposer;
