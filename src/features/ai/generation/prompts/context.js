module.exports = (name, loc, dob, cat, qual, insights, currentDate, currentYear) => `
# CURRENT SYSTEM DATA (DO NOT DEVIATE):
- Today's Date: ${currentDate}
- Current Year: ${currentYear}
- User Profile: Name: ${name} | Location: ${loc} | DOB: ${dob} | Category: ${cat} | Qualification: ${qual}
- User Insights: ${insights}
`;
