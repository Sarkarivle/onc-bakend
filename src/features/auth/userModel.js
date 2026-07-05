const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin', 'expert'], default: 'user' },
  isVerified: { type: Boolean, default: false },

  // Personalization Fields
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  category: { type: String, enum: ['General', 'OBC', 'SC', 'ST', 'EWS'], default: 'General' },
  dob: { type: Date },
  // --- ACADEMIC DEPTH (Multi-Level) ---
  educationLevel: { type: String }, // Highest Level (10th, 12th, Graduate, etc.)
  educationHistory: {
    tenth: { year: Number, percentage: Number },
    twelfth: {
        year: Number,
        percentage: Number,
        stream: { type: String, enum: ['Science (PCM)', 'Science (PCB)', 'Commerce', 'Arts', 'Agriculture', 'Other'] },
        isDiploma: { type: Boolean, default: false } // If user did 3-yr Diploma instead of 12th
    },
    graduation: {
        year: Number,
        percentage: Number,
        degree: String, // B.A, B.Sc, B.Tech, etc.
        isAppearing: { type: Boolean, default: false }
    },
    postGraduation: {
        year: Number,
        percentage: Number,
        degree: String,
        isAppearing: { type: Boolean, default: false }
    }
  },
  professionalDegrees: [{ type: String }], // B.Ed, BTC, ITI, etc.

  // Physical & Medical
  height: { type: Number }, // in cm
  weight: { type: Number }, // in kg
  chest: { type: Number }, // in cm (Male only usually)
  vision: { type: String }, // 6/6, 6/9

  // Skills & Special
  certificates: [{ type: String }], // CCC, O-Level, Tally
  typingSkills: [{ type: String }], // English, Hindi
  stenoSkill: { type: Boolean, default: false },
  drivingLicense: { type: String, enum: ['None', 'LMV', 'HMV'], default: 'None' },
  nccCertificate: { type: String, enum: ['None', 'A', 'B', 'C'], default: 'None' },
  sportsLevel: { type: String, enum: ['None', 'District', 'State', 'National'], default: 'None' },

  // Status & Location
  maritalStatus: { type: String, enum: ['Single', 'Married', 'Widow', 'Divorcee'], default: 'Single' },
  serviceStatus: { type: String, enum: ['Fresh', 'Ex-Serviceman', 'Govt Employee'], default: 'Fresh' },
  serviceYears: { type: Number, default: 0 },
  domicileState: { type: String, default: 'Uttar Pradesh' },
  city: { type: String },

  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model('User', userSchema);
