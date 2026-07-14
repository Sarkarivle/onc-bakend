const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const SourceService = require('../features/sources/sourceService');

function getArgValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1];
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI is required.');

  const limit = Number(getArgValue(process.argv.slice(2), '--limit') || 20);
  await mongoose.connect(mongoUri);

  const result = await SourceService.refreshDue({ limit });
  const health = await SourceService.healthReport();

  await mongoose.disconnect();

  console.log('============================================================');
  console.log('OFFICIAL SOURCE REFRESH COMPLETE');
  console.log(`Processed: ${result.processed}`);
  console.log(`Changed:   ${result.changed}`);
  console.log(`Failed:    ${result.failed}`);
  console.log(`Stale:     ${health.stale}/${health.total}`);
  console.log('============================================================');

  if (result.failed > 0) process.exitCode = 1;
}

run().catch(async (error) => {
  console.error('Critical Error:', error.message);
  try {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
