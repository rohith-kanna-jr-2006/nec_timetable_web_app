/**
 * Phase 12 - Seed integrity + test isolation suite.
 *
 * Verifies canonical seed data survives test execution, that fixtures are owned
 * and scoped, and that no broad deletion targets shared collections.
 *
 * Isolation: fixtures use the P12 namespace (department 'P12T', ids prefixed
 * 'P12'). Cleanup removes only those exact records.
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const fsx = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const Course = require('../src/models/Course');
const Faculty = require('../src/models/Faculty');
const User = require('../src/models/User');
const AcademicContext = require('../src/models/AcademicContext');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const FacultyWorkload = require('../src/models/FacultyWorkload');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const CourseFacultyHandler = require('../src/models/CourseFacultyHandler');
const { seedUsers } = require('../src/seeds/seedUsers');
const { seedWorkload } = require('../src/seeds/seedWorkload');
const { seedHandlers } = require('../src/seeds/seedHandlers');
const { seedAcademicContext } = require('../src/seeds/seedAcademicContext');
const { seedTimetable } = require('../src/seeds/seedTimetable');
const { P12, cleanupP12Fixtures } = require('./helpers/testIsolation');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log('  PASS: ' + message);
  } else {
    failCount++;
    console.error('  FAIL: ' + message);
  }
}

async function baselineCounts() {
  return {
    courses: await Course.countDocuments(),
    faculty: await Faculty.countDocuments(),
    users: await User.countDocuments(),
    contexts: await AcademicContext.countDocuments(),
    allocations: await HODFacultyAllocation.countDocuments(),
    workloads: await FacultyWorkload.countDocuments(),
    versions: await TimetableVersion.countDocuments(),
    sessions: await TimetableSession.countDocuments(),
  };
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 12: SEED INTEGRITY + TEST ISOLATION');
  console.log('===============================================================\n');

  await connectDB();

  const before = await baselineCounts();
  console.log('      [baseline] ' + JSON.stringify(before));

  console.log('\n-- A: Seed idempotency ----------------------------------');

  await seedAcademicContext();
  const ctx1 = await AcademicContext.countDocuments();
  await seedAcademicContext();
  const ctx2 = await AcademicContext.countDocuments();
  assert(ctx1 === ctx2, 'AcademicContext seed is idempotent (' + ctx1 + ' -> ' + ctx2 + ')');
  assert(ctx2 === before.contexts, 'AcademicContext count unchanged by re-seeding');

  await seedUsers();
  const u1 = await User.countDocuments();
  await seedUsers();
  const u2 = await User.countDocuments();
  assert(u1 === u2, 'User seed is idempotent (' + u1 + ' -> ' + u2 + ')');
  assert(u2 === before.users, 'User seed preserves unrelated accounts (no global wipe)');

  await seedWorkload();
  const w1 = await FacultyWorkload.countDocuments();
  await seedWorkload();
  const w2 = await FacultyWorkload.countDocuments();
  assert(w1 === w2, 'Workload seed is idempotent (' + w1 + ' -> ' + w2 + ')');
  assert(w2 === before.workloads, 'Workload seed preserves unrelated records (no global wipe)');

  await seedHandlers();
  const h1 = await CourseFacultyHandler.countDocuments();
  await seedHandlers();
  const h2 = await CourseFacultyHandler.countDocuments();
  assert(h1 === h2, 'Handler seed is idempotent (' + h1 + ' -> ' + h2 + ')');

  console.log('\n-- B: Timetable history safety ---------------------------');

  const vBefore = await TimetableVersion.countDocuments();
  const sBefore = await TimetableSession.countDocuments();
  await seedTimetable();
  const vAfter = await TimetableVersion.countDocuments();
  const sAfter = await TimetableSession.countDocuments();
  assert(vAfter === vBefore, 'seedTimetable preserves TimetableVersion history (' + vBefore + ' -> ' + vAfter + ')');
  assert(sAfter === sBefore, 'seedTimetable preserves TimetableSession history (' + sBefore + ' -> ' + sAfter + ')');

  console.log('\n-- C: Fixture isolation ----------------------------------');

  const sharedCtx = await AcademicContext.findOne({ department: 'CSE' }).lean();
  const sharedAllocBefore = await HODFacultyAllocation.countDocuments({ academicContextId: sharedCtx._id });

  const ctx = await AcademicContext.create({
    academicYearFrom: 2096, academicYearTo: 2097, semester: 'Odd Semester',
    department: P12.department, year: 'III Year', section: 'A', program: 'UG', status: 'ACTIVE',
  });
  const version = await TimetableVersion.create({
    academicContextId: ctx._id, academicYear: '2096-97', semester: 'Odd Semester',
    department: P12.department, year: 'III Year', section: 'A', version: 1,
    versionLabel: P12.versionLabelPrefix + 'Version', status: 'DRAFT',
  });
  await TimetableSession.create({
    timetableVersionId: version._id, academicContextId: ctx._id, courseCode: P12.coursePrefix + 'C1',
    courseName: 'P12 Course', facultyId: 'P12-FAC-1', facultyName: 'P12 Faculty',
    day: 'MON', period: 'P1', room: 'LH-P12', sessionType: 'THEORY',
  });

  assert((await TimetableSession.countDocuments({ academicContextId: ctx._id })) === 1, 'P12 fixture session created');
  const sharedDuring = await HODFacultyAllocation.countDocuments({ academicContextId: sharedCtx._id });
  assert(sharedDuring === sharedAllocBefore, 'Creating a P12 fixture does not touch a shared context');

  await cleanupP12Fixtures();
  assert((await AcademicContext.countDocuments({ department: P12.department })) === 0, 'P12 context removed');
  assert((await TimetableVersion.countDocuments({ academicContextId: ctx._id })) === 0, 'P12 version removed');
  assert((await TimetableSession.countDocuments({ academicContextId: ctx._id })) === 0, 'P12 sessions removed');
  assert((await HODFacultyAllocation.countDocuments({ academicContextId: sharedCtx._id })) === sharedAllocBefore, 'Shared context untouched throughout');

  console.log('\n-- D: No broad deletion in seeds -----------------------');

  const seedDir = path.join(__dirname, '..', 'src', 'seeds');
  const offenders = [];
  fsx.readdirSync(seedDir).forEach((f) => {
    if (!f.endsWith('.js')) return;
    const text = fsx.readFileSync(path.join(seedDir, f), 'utf8');
    text.split(/\r?\n/).forEach((line, i) => {
      if (/\.deleteMany\(\s*\{\s*\}\s*\)/.test(line)) offenders.push(f + ' L' + (i + 1));
    });
  });
  assert(offenders.length === 0, 'No seed performs a global deleteMany({})' + (offenders.length ? ' -> ' + offenders.join(', ') : ''));

  const helperText = fsx.readFileSync(path.join(__dirname, 'helpers', 'testIsolation.js'), 'utf8');
  assert(!/\.deleteMany\(\s*\{\s*\}\s*\)/.test(helperText), 'Test isolation helper performs no global deleteMany({})');
  assert(!/\.drop\(/.test(helperText), 'Test isolation helper never drops a collection');

  console.log('\n-- E: Deterministic fixture shape -----------------------');

  const makeFixture = async (section) => AcademicContext.create({
    academicYearFrom: 2096, academicYearTo: 2097, semester: 'Odd Semester',
    department: P12.department, year: 'III Year', section: section, program: 'UG', status: 'ACTIVE',
  });

  const shapeA = [];
  for (let i = 0; i < 2; i++) shapeA.push(String((await makeFixture('A' + i))._id));
  const shapeB = [];
  for (let i = 0; i < 2; i++) shapeB.push(String((await makeFixture('B' + i))._id));
  assert(shapeA.length === 2 && shapeB.length === 2, 'Repeated fixture creation produces the same structure');
  assert(new Set(shapeA.concat(shapeB)).size === 4, 'Each fixture instance gets a distinct _id (no collision)');
  await cleanupP12Fixtures();

  console.log('\n-- F: Baseline integrity ---------------------------------');

  const after = await baselineCounts();
  console.log('      [after]    ' + JSON.stringify(after));
  ['courses', 'faculty', 'contexts', 'allocations', 'versions', 'sessions'].forEach((k) => {
    assert(after[k] === before[k], k + ' count unchanged by the Phase 12 suite (' + before[k] + ' -> ' + after[k] + ')');
  });

  console.log('\n===============================================================');
  console.log('PHASE 12 SEED + ISOLATION: ' + passCount + ' PASSED, ' + failCount + ' FAILED');
  console.log('===============================================================\n');
}

(async () => {
  try {
    await runTests();
  } catch (error) {
    failCount++;
    console.error('\n[FATAL] Phase 12 suite aborted:', error && error.message ? error.message : error);
  } finally {
    try { await cleanupP12Fixtures(); } catch (e) { /* best effort */ }
    await disconnectDB();
  }
  process.exit(failCount > 0 ? 1 : 0);
})();
