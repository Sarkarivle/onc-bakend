const EligibilityEngine = require('./src/features/eligibility/EligibilityEngine');

async function test() {
    const user = {
        name: "Himanshu",
        dob: "1998-05-15",
        category: "OBC",
        education: "GRADUATE"
    };

    const notification = {
        title: "SSC CGL 2024",
        cutoff_date: "2024-08-01",
        base_constraints: {
            age: { min: 18, max: 27 },
            education: { level: "GRADUATE" }
        },
        relaxations: [
            { category: "OBC", constraint: "MAX_AGE", value: 3 }
        ]
    };

    console.log("--- TEST: OBC Candidate ---");
    const result = await EligibilityEngine.evaluate(user, notification);
    console.log("Status:", result.status);
    console.log("Exact Age:", result.age_analysis.exact_age.formatted);
    console.log("Eligible:", result.status === 'ELIGIBLE' ? "✅ YES" : "❌ NO");
}

test();
