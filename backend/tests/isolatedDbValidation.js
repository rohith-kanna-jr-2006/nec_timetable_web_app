/**
 * Phase G: Isolated Database Validation Script
 * Validates fresh database, dual-seed idempotency, duplicate prevention,
 * faculty creation, workload creation, allocation retrieval, and curriculum integrity.
 */

const mongoose = require('mongoose');

const TEST_DB_URI = process.env.ISOLATED_TEST_DB_URI || 'mongodb://127.0.0.1:27017/nec_faculty_isolated_val_db';

async function runIsolatedDbValidation() {
  console.log('============================================================');
  console.log('PHASE G: ISOLATED DATABASE VALIDATION');
  console.log(`Database URI: mongodb://127.0.0.1:27017/nec_faculty_isolated_val_db`);
  console.log('============================================================\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      passCount++;
      console.log(`  ✓ PASS: ${message}`);
    } else {
      failCount++;
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  process.env.MONGODB_URI = TEST_DB_URI;

  const { connectDB, disconnectDB } = require('../src/config/db');
  const Faculty = require('../src/models/Faculty');
  const FacultyWorkload = require('../src/models/FacultyWorkload');
  const Course = require('../src/models/Course');
  const AcademicContext = require('../src/models/AcademicContext');
  const User = require('../src/models/User');
  const TimetableVersion = require('../src/models/TimetableVersion');
  const TimetableSession = require('../src/models/TimetableSession');
  const { seedFaculty } = require('../src/seeds/seedFaculty');
  const { seedWorkload } = require('../src/seeds/seedWorkload');
  const { seedCourses } = require('../src/seeds/seedCourses');
  const { seedAcademicContext } = require('../src/seeds/seedAcademicContext');
  const { seedUsers } = require('../src/seeds/seedUsers');
  const { seedHandlers } = require('../src/seeds/seedHandlers');
  const { seedTimetable } = require('../src/seeds/seedTimetable');
  const { formatFacultyAllocations } = require('../src/services/workloadService');

  try {
    // 1. Fresh database setup
    console.log('--- 1. Fresh Database Setup ---');
    await connectDB(TEST_DB_URI);
    await mongoose.connection.dropDatabase();
    console.log('  Cleaned/dropped isolated test database.');
    assert(mongoose.connection.readyState === 1, 'Connected to isolated test database');

    // 2. First seed pass
    console.log('\n--- 2. First Seed Pass ---');
    await seedWorkload();
    await seedFaculty();
    await seedCourses();
    await seedAcademicContext();
    await seedUsers();
    await seedHandlers();
    await seedTimetable();
    console.log('  First seed pass completed.');

    const initialFacultyCount = await Faculty.countDocuments({});
    const initialWorkloadCount = await FacultyWorkload.countDocuments({});
    const initialCourseCount = await Course.countDocuments({});
    const initialUserCount = await User.countDocuments({});

    assert(initialFacultyCount === 27, `First seed: Exactly 27 faculty created (got: ${initialFacultyCount})`);
    assert(initialWorkloadCount === 27, `First seed: Exactly 27 workloads created (got: ${initialWorkloadCount})`);
    assert(initialCourseCount === 119, `First seed: Exactly 119 courses created (got: ${initialCourseCount})`);
    assert(initialUserCount >= 4, `First seed: Standard users created (got: ${initialUserCount})`);

    // 3. Second seed pass (Idempotency verification)
    console.log('\n--- 3. Second Seed Pass (Idempotency) ---');
    await seedWorkload();
    await seedFaculty();
    await seedCourses();
    await seedAcademicContext();
    await seedUsers();
    await seedHandlers();
    await seedTimetable();
    console.log('  Second seed pass completed.');

    // 4. Verify no duplicates
    console.log('\n--- 4. Verify No Duplicates ---');
    const postSecondFacultyCount = await Faculty.countDocuments({});
    const postSecondWorkloadCount = await FacultyWorkload.countDocuments({});
    const postSecondCourseCount = await Course.countDocuments({});
    const postSecondUserCount = await User.countDocuments({});

    assert(postSecondFacultyCount === initialFacultyCount, `Idempotency: Faculty count unchanged (${postSecondFacultyCount})`);
    assert(postSecondWorkloadCount === initialWorkloadCount, `Idempotency: Workload count unchanged (${postSecondWorkloadCount})`);
    assert(postSecondCourseCount === initialCourseCount, `Idempotency: Course count unchanged (${postSecondCourseCount})`);
    assert(postSecondUserCount === initialUserCount, `Idempotency: User count unchanged (${postSecondUserCount})`);

    // 5. Verify Curriculum Integrity
    console.log('\n--- 5. Verify Curriculum Integrity ---');
    const r22UgCourses = await Course.find({ regulation: 'R22', isElective: false });
    const pecCourses = await Course.find({ isR22UG: true, electiveType: 'PEC' });
    const mgmtElectives = await Course.find({ isR22UG: true, electiveType: 'Management Elective' });
    const openElectives = await Course.find({ isR22UG: true, electiveType: 'OEC' });

    assert(pecCourses.length === 48, `Curriculum: Exactly 48 PEC elective courses (got: ${pecCourses.length})`);
    assert(mgmtElectives.length === 4, `Curriculum: Exactly 4 Management electives (got: ${mgmtElectives.length})`);
    assert(openElectives.length === 2, `Curriculum: Exactly 2 Open electives (got: ${openElectives.length})`);

    const mockCodes = await Course.find({ courseCode: { $in: ['26CSC01', '26CSP01'] } });
    assert(mockCodes.length === 0, `Curriculum: Zero mock codes present in database (got: ${mockCodes.length})`);

    // 6. Verify Faculty Creation with Auto-Generated ID & Workload
    console.log('\n--- 6. Verify Faculty & Workload Creation ---');
    const { calculateTeachingHours, calculateResponsibilityHours } = require('../src/services/workloadService');

    // Create test faculty
    const testId = 'FWL-28';
    const newFaculty = await Faculty.create({
      facultyId: testId,
      facultyName: 'Dr. Isolated Test Candidate',
      designation: 'Assistant Professor',
      department: 'Department of Computer Science and Engineering',
      email: 'isolated.test@nec.edu.in',
      roles: ['FACULTY'],
    });
    assert(newFaculty.facultyId === testId, `Faculty created with ID ${testId}`);

    const teaching = {
      ugTheory1: [{ category: 'UG Theory 1', courseCode: '22CSC14', courseName: 'Principles of Compiler Design', allocation: 'UG III Year A', hours: 4 }],
      lab1: [{ category: 'Lab 1', courseCode: '22CSP07', courseName: 'Compiler Design Laboratory', allocation: 'UG III Year A', hours: 2 }],
      pg: [{ category: 'PG', courseCode: '22CPB05', courseName: 'Advanced Distributed Systems', allocation: 'PG I Year', hours: 1 }],
      others: [{ category: 'Others', courseName: 'Project Guidance', allocation: 'UG II Year B', hours: 2 }],
    };
    const responsibilities = [
      { category: 'RESPONSIBILITY', role: 'Timetable Coordinator', allocation: 'Departmental', hours: 3, responsibilityType: 'Coordination' },
    ];

    const calcTeaching = calculateTeachingHours(teaching);
    const calcResp = calculateResponsibilityHours(responsibilities);
    const calcTotal = calcTeaching + calcResp;

    assert(calcTeaching === 9, `Calculated teaching hours is 9 (got: ${calcTeaching})`);
    assert(calcResp === 3, `Calculated responsibility hours is 3 (got: ${calcResp})`);
    assert(calcTotal === 12, `Calculated total hours is 12 (got: ${calcTotal})`);

    const newWorkload = await FacultyWorkload.create({
      facultyId: testId,
      facultyName: newFaculty.facultyName,
      designation: newFaculty.designation,
      department: newFaculty.department,
      teaching,
      responsibilities,
      calculatedTeachingHours: calcTeaching,
      calculatedResponsibilityHours: calcResp,
      calculatedTotalHours: calcTotal,
      sourceTotalHours: calcTotal,
      status: 'MATCHED',
    });
    assert(newWorkload.calculatedTotalHours === 12, 'Workload successfully persisted with 12 total hours');

    // 7. Verify Allocation Retrieval
    console.log('\n--- 7. Verify Allocation Retrieval ---');
    const formatted = formatFacultyAllocations(newWorkload);
    assert(formatted.facultyId === testId, `Allocations retrieved for ${testId}`);
    assert(formatted.summary.totalHours === 12, `Summary total hours matches 12`);
    assert(formatted.teachingLoad.ugTheory.length === 1, 'Teaching load has 1 UG theory item');
    assert(formatted.teachingLoad.labs.length === 1, 'Teaching load has 1 lab item');
    assert(formatted.teachingLoad.pg.length === 1, 'Teaching load has 1 PG item');
    assert(formatted.teachingLoad.others.length === 1, 'Teaching load has 1 others item');
    assert(formatted.responsibilities.coordination.length === 1, 'Responsibilities has 1 coordination item');
    assert(formatted.allocations.length === 5, 'Total flat allocations count is 5');

    // Clean up isolated test database
    await mongoose.connection.dropDatabase();
    console.log('\nCleaned and dropped isolated test database.');

    console.log('\n============================================================');
    console.log(`PHASE G ISOLATED DB VALIDATION: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[Phase G Validation Error]', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runIsolatedDbValidation();
}

module.exports = { runIsolatedDbValidation };
