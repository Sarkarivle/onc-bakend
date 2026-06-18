const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Local MongoDB Connection (VPS ke liye localhost use hoga)
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB Connected Successfully (onc_db)'))
  .catch(err => console.log('DB Connection Error:', err));

// Jansewa Kendra Route
app.get('/api/jansewa-kendras', async (req, res) => {
  // In real implementation, fetch this from MongoDB:
  // const kendras = await KendraModel.find();
  res.json([
    {
      name: "Aditya Digital Center",
      location: "Katra, Shahjahanpur",
      rating: 4.8,
      formsFilled: 1250,
      isVerified: true,
      iconType: "store",
      startingPrice: 49,
      description: "Expert in govt forms and digital services."
    },
    {
      name: "Digital Help Center",
      location: "Civil Lines, Lucknow",
      rating: 4.9,
      formsFilled: 3200,
      isVerified: true,
      iconType: "computer",
      startingPrice: 50,
      description: "Fastest form filling service in Lucknow."
    },
    {
      name: "Sharma Jan Seva",
      location: "Bareilly, UP",
      rating: 4.6,
      formsFilled: 850,
      isVerified: true,
      iconType: "devices",
      startingPrice: 49,
      description: "Reliable and verified digital center."
    }
  ]);
});

// Msg91 OTP Placeholder
app.post('/api/send-otp', (req, res) => {
    const { phoneNumber } = req.body;
    // Implement Msg91 logic here
    res.json({ success: true, message: "OTP sent successfully" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
