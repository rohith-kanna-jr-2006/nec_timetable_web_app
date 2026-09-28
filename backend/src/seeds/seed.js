require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const { seedFaculty } = require('./seedFaculty');
const { seedWorkload } = require('./seedWorkload');
const { seedCourses } = require('./seedCourses');
const { seedAcademicContext } = require('./seedAcademicContext');
const { seedUsers } = require('./seedUsers');
const { seedHandlers } = require('./seedHandlers');
const { seedTimetable } = require('./seedTimetable');

async function runMasterSeed() {
  console.log('============================================================');
  console.log('NEC FACULTY TIMETABLE: DATABASE SEED & WORKLOAD MIGRATION');
  console.log('============================================================\n');

  try {
    console.log('[Seed] Verifying MongoDB connection...');
    await connectDB();

    // 1. Seed authoritative 28-faculty workload master dataset
    await seedWorkload();

    // 2. Seed faculty master directory
    await seedFaculty();

    // 3. Seed course catalog
    await seedCourses();

    // 4. Seed academic contexts
    await seedAcademicContext();

    // 5. Seed development user accounts
    await seedUsers();

    // 6. Seed initial course faculty handlers
    await seedHandlers();

    // 7. Seed published timetable version and session schedule
    await seedTimetable();

    console.log('\n============================================================');
    console.log('MASTER DATABASE SEEDING COMPLETED SUCCESSFULLY');
    console.log('============================================================');
  } catch (error) {
    console.error('\n[Seed Error] Database seeding encountered an error:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runMasterSeed();
}

module.exports = { runMasterSeed };
