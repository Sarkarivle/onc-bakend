require('dotenv').config();
const mongoose = require('mongoose');
const Jansewa = require('../features/jansewa/jansewaModel');

const VALID_CATEGORIES = [
  'Jansewa Kendra',
  'Student Rooms',
  'Tiffin Service',
  'Book Store',
  'Coaching',
  'Home Tutors',
  'Stationary',
];

const normalizeCategory = (category) => {
  if (!category) return 'Jansewa Kendra';
  const value = String(category).trim().replace(/\s+/g, ' ');
  return VALID_CATEGORIES.find((item) => item.toLowerCase() === value.toLowerCase()) || value;
};

const normalizeStatus = (status) => {
  const value = String(status || 'pending').trim().toLowerCase();
  return ['pending', 'approved', 'rejected'].includes(value) ? value : 'pending';
};

async function main() {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/onc_db';
  await mongoose.connect(mongoURI);

  const partners = await Jansewa.find();
  let changed = 0;

  for (const partner of partners) {
    const category = normalizeCategory(partner.category);
    const status = normalizeStatus(partner.status);
    const isVerified = status === 'approved';

    if (partner.category !== category || partner.status !== status || partner.isVerified !== isVerified) {
      partner.category = category;
      partner.status = status;
      partner.isVerified = isVerified;
      await partner.save();
      changed += 1;
    }
  }

  console.log(`Repaired ${changed}/${partners.length} Jansewa partners`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
