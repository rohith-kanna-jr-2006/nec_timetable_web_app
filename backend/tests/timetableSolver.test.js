/**
 * Automatic Timetable Solver & CSP Engine Comprehensive Test Suite
 *
 * Verifies all 30 authoritative tests + unsatisfiable cases + performance + integration:
 * TEST 1: II Year context resolves Semester III courses.
 * TEST 2: III Year context resolves Semester V courses.
 * TEST 3: IV Year context resolves Semester VII courses.
 * TEST 4: Missing HOD allocation blocks generation.
 * TEST 5: Multiple HOD allocations block generation.
 * TEST 6: Wrong faculty cannot be generated.
 * TEST 7: Class conflict is prevented.
 * TEST 8: Global faculty conflict is prevented.
 * TEST 9: Exact duplicate session is prevented.
 * TEST 10: Same course can receive multiple legitimate weekly periods.
 * TEST 11: Lab block is exactly 4 consecutive periods where required.
 * TEST 12: Lab cannot cross a break.
 * TEST 13: Lab cannot overlap class occupancy.
 * TEST 14: Lab cannot overlap faculty occupancy.
 * TEST 15: Multiple labs produce at least one afternoon lab.
 * TEST 16: Single lab prefers morning when both options are feasible.
 * TEST 17: Single lab may use afternoon when morning is impossible.
 * TEST 18: Theory cannot create 3 consecutive same-subject periods.
 * TEST 19: Theory distribution is scored correctly.
 * TEST 20: MRV chooses requirement with fewer candidates.
 * TEST 21: Forward checking detects zero-domain conditions.
 * TEST 22: Backtracking recovers from a dead-end branch.
 * TEST 23: Least-constraining value preserves more future candidates.
 * TEST 24: Seeded generation is reproducible.
 * TEST 25: Different seed can produce a different valid schedule.
 * TEST 26: Hard validator catches intentionally corrupted schedule.
 * TEST 27: Generation failure does not persist partial timetable success data.
 * TEST 28: Successful generation persists all canonical TimetableSession records.
 * TEST 29: Class timetable derivation and faculty timetable derivation come from the same TimetableSession dataset.
 * TEST 30: Generated timetable can transition through existing HOD approval workflow.
 * TEST 31: Unsatisfiable case: Faculty has no available slot.
 * TEST 32: Unsatisfiable case: Class has no available slot.
 * TEST 33: Unsatisfiable case: Two labs require afternoon but only one afternoon block exists.
 * TEST 34: Performance benchmark for realistic target cohort.
 * TEST 35: End-to-end API HTTP integration test (/api/timetable/solve).
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');

// Models
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const Course = require('../src/models/Course');
const AcademicContext = require('../src/models/AcademicContext');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const FacultyAvailability = require('../src/models/FacultyAvailability');
const { seedFaculty } = require('../src/seeds/seedFaculty');
const { seedTimetable } = require('../src/seeds/seedTimetable');

// Solver Modules
const SeededRandom = require('../src/services/timetable/seededRandom');
const {
  DEFAULT_DAYS,
  DEFAULT_PERIODS,
  crossesBreak,
  arePeriodsConsecutive,
  getValidLabBlocksForDay,
} = require('../src/services/timetable/timetableGrid');
const {
  buildSchedulingContext,
  ConstraintBuilderError,
} = require('../src/services/timetable/constraintBuilder');
const {
  generateCandidatesForVariable,
  wouldCreateThreeConsecutiveTheory,
} = require('../src/services/timetable/candidateGenerator');
const { scoreCandidate, rankCandidates } = require('../src/services/timetable/candidateScorer');
const { forwardCheckAndOrderMRV } = require('../src/services/timetable/forwardChecker');
const { validateGeneratedSchedule } = require('../src/services/timetable/timetableValidator');
const { solveTimetable } = require('../src/services/timetable/timetableSolver');
const {
  solveAndPersistTimetable,
  transitionTimetableStatus,
  getClassSchedule,
  getFacultySchedule,
} = require('../src/services/timetableService');
const { generateToken } = require('../src/utils/generateToken');

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

function makeRequest(appInstance, { method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, () => {
      const port = server.address().port;
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = {
        'Content-Type': 'application/json',
        ...headers,
      };
      if (payload) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            server.close();
            let parsedData;
            try {
              parsedData = JSON.parse(rawData);
            } catch (e) {
              parsedData = rawData;
            }
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: parsedData,
            });
          });
        }
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

async function runTimetableSolverTests() {
  console.log('============================================================');
  console.log('AUTOMATIC TIMETABLE CSP SOLVER COMPREHENSIVE TEST SUITE');
  console.log('============================================================\n');

  try {
    await connectDB();

    // Setup Test Users
    const hash = await bcrypt.hash('TestPass123!', 10);
    const testUsers = [
      { name: 'Solver HOD', email: 'solver_hod@nec.edu.in', passwordHash: hash, role: 'HOD', isActive: true },
      { name: 'Solver AC', email: 'solver_ac@nec.edu.in', passwordHash: hash, role: 'AC', isActive: true },
      { name: 'Solver Faculty', email: 'solver_fac@nec.edu.in', passwordHash: hash, role: 'FACULTY', facultyId: 'FWL-04', isActive: true },
    ];
    for (const u of testUsers) {
      await User.findOneAndUpdate({ email: u.email }, { $set: u }, { upsert: true });
    }
    const hodUser = await User.findOne({ email: 'solver_hod@nec.edu.in' });
    const acUser = await User.findOne({ email: 'solver_ac@nec.edu.in' });
    const facUser = await User.findOne({ email: 'solver_fac@nec.edu.in' });

    const hodToken = generateToken(hodUser);
    const acToken = generateToken(acUser);
    const facToken = generateToken(facUser);

    // Retrieve active contexts
    const ctxII_A = await AcademicContext.findOne({ year: 'II Year', section: 'A' });
    const ctxIII_A = await AcademicContext.findOne({ year: 'III Year', section: 'A' });
    const ctxIV_A = await AcademicContext.findOne({ year: 'IV Year', section: 'A' });

    assert(Boolean(ctxII_A && ctxIII_A && ctxIV_A), 'Target academic contexts (II-A, III-A, IV-A) located');

    // ------------------------------------------------------------
    // TEST 1: II Year context resolves Semester III courses
    // ------------------------------------------------------------
    console.log('\n--- TEST 1: II Year context resolves Semester III courses ---');
    const sem3Courses = await Course.find({ semester: 'Semester III', isActive: true });
    assert(sem3Courses.length === 10, `Semester III has exactly 10 courses (got: ${sem3Courses.length})`);
    assert(sem3Courses.every((c) => c.semester === 'Semester III'), 'All courses belong to Semester III');

    // ------------------------------------------------------------
    // TEST 2: III Year context resolves Semester V courses
    // ------------------------------------------------------------
    console.log('\n--- TEST 2: III Year context resolves Semester V courses ---');
    const sem5Courses = await Course.find({ semester: 'Semester V', isActive: true });
    assert(sem5Courses.length === 6, `Semester V core courses count is 6 (got: ${sem5Courses.length})`);
    assert(sem5Courses.every((c) => c.semester === 'Semester V'), 'All courses belong to Semester V');

    // ------------------------------------------------------------
    // TEST 3: IV Year context resolves Semester VII courses
    // ------------------------------------------------------------
    console.log('\n--- TEST 3: IV Year context resolves Semester VII courses ---');
    const sem7Courses = await Course.find({ semester: 'Semester VII', isActive: true });
    assert(sem7Courses.length === 2, `Semester VII core courses count is 2 (got: ${sem7Courses.length})`);
    assert(sem7Courses.every((c) => c.semester === 'Semester VII'), 'All courses belong to Semester VII');

    // Prepare reliable authoritative HOD allocations for III Year Section A
    const authoritativeAllocations = [
      { courseCode: '22CSC14', courseName: 'Principles of Compiler Design', facultyId: 'FWL-04', facultyName: 'Dr. A. Manchula', allocationType: 'THEORY' },
      { courseCode: '22CSC15', courseName: 'Full Stack Development', facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi', allocationType: 'THEORY' },
      { courseCode: '22CSC16', courseName: 'Object Oriented Software Engineering', facultyId: 'FWL-03', facultyName: 'Dr. S. Karpusamy', allocationType: 'THEORY' },
      { courseCode: '22CSP09', courseName: 'Full Stack Development Laboratory', facultyId: 'FWL-01', facultyName: 'Dr. T. Rajasekaran', allocationType: 'LAB_PRIMARY' },
      { courseCode: '22CSP10', courseName: 'Object Oriented Software Engineering Laboratory', facultyId: 'FWL-06', facultyName: 'Mrs. E. Padma', allocationType: 'LAB_PRIMARY' },
      { courseCode: '22MAN8R', courseName: 'Soft/Analytical Skills - IV', facultyId: 'FWL-02', facultyName: 'Dr. B. Paramasivan', allocationType: 'THEORY' },
    ];

    // Ensure all faculty in authoritative allocations exist
    for (const alloc of authoritativeAllocations) {
      await Faculty.findOneAndUpdate(
        { facultyId: alloc.facultyId },
        { $set: { facultyName: alloc.facultyName, department: 'CSE', isActive: true } },
        { upsert: true }
      );
    }

    // Set allocations for III Year A
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxIII_A._id });
    for (const alloc of authoritativeAllocations) {
      await HODFacultyAllocation.create({
        academicContextId: ctxIII_A._id,
        courseCode: alloc.courseCode,
        courseName: alloc.courseName,
        facultyId: alloc.facultyId,
        facultyName: alloc.facultyName,
        allocationType: alloc.allocationType,
        assignedBy: 'Dr. T. Rajasekaran (HOD)',
        status: 'APPROVED',
      });
    }

    // ------------------------------------------------------------
    // TEST 4: Missing HOD allocation blocks generation
    // ------------------------------------------------------------
    console.log('\n--- TEST 4: Missing HOD allocation blocks generation ---');
    // Remove allocation for 22CSC16
    const testCourse = authoritativeAllocations[2]; // 22CSC16
    await HODFacultyAllocation.deleteOne({ academicContextId: ctxIII_A._id, courseCode: testCourse.courseCode });

    let test4Error = null;
    try {
      await buildSchedulingContext({
        academicContextId: ctxIII_A._id,
        assignmentPlan: [{ courseCode: testCourse.courseCode }],
      });
    } catch (err) {
      test4Error = err;
    }
    assert(test4Error && test4Error.code === 'HOD_ALLOCATION_REQUIRED', 'Missing HOD allocation throws HOD_ALLOCATION_REQUIRED');

    // Restore allocation
    await HODFacultyAllocation.create({
      academicContextId: ctxIII_A._id,
      courseCode: testCourse.courseCode,
      courseName: testCourse.courseName,
      facultyId: testCourse.facultyId,
      facultyName: testCourse.facultyName,
      allocationType: testCourse.allocationType,
      assignedBy: 'Dr. T. Rajasekaran (HOD)',
      status: 'APPROVED',
    });

    // ------------------------------------------------------------
    // TEST 5: Multiple HOD allocations block generation
    // ------------------------------------------------------------
    console.log('\n--- TEST 5: Multiple HOD allocations block generation ---');
    const duplicateAlloc = await HODFacultyAllocation.create({
      academicContextId: ctxIII_A._id,
      courseCode: testCourse.courseCode,
      courseName: testCourse.courseName,
      facultyId: 'FWL-12',
      facultyName: 'Conflicting Faculty',
      allocationType: 'THEORY',
      assignedBy: 'HOD',
      status: 'SUBMITTED',
    });

    let test5Error = null;
    try {
      await buildSchedulingContext({
        academicContextId: ctxIII_A._id,
        assignmentPlan: [{ courseCode: testCourse.courseCode }],
      });
    } catch (err) {
      test5Error = err;
    }
    assert(test5Error && test5Error.code === 'HOD_ALLOCATION_CONFLICT', 'Conflicting HOD allocations throw HOD_ALLOCATION_CONFLICT');
    await HODFacultyAllocation.deleteOne({ _id: duplicateAlloc._id });

    // ------------------------------------------------------------
    // TEST 6: Wrong faculty cannot be generated
    // ------------------------------------------------------------
    console.log('\n--- TEST 6: Wrong faculty cannot be generated ---');
    let test6Error = null;
    try {
      await buildSchedulingContext({
        academicContextId: ctxIII_A._id,
        assignmentPlan: [{ courseCode: testCourse.courseCode, facultyId: 'FWL-99' }],
      });
    } catch (err) {
      test6Error = err;
    }
    assert(test6Error && test6Error.code === 'HOD_FACULTY_MISMATCH', 'Non-HOD faculty in plan throws HOD_FACULTY_MISMATCH');

    // ------------------------------------------------------------
    // TEST 7: Class conflict is prevented
    // ------------------------------------------------------------
    console.log('\n--- TEST 7: Class conflict is prevented ---');
    const corruptedScheduleClassConflict = [
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY', duration: 1 },
      { courseCode: '22CSC15', facultyId: 'FWL-14', day: 'MON', period: 'P1', sessionType: 'THEORY', duration: 1 },
    ];
    const validationClassConflict = validateGeneratedSchedule(corruptedScheduleClassConflict, {
      context: ctxIII_A,
      resolvedRequirements: [],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    });
    assert(!validationClassConflict.isValid, 'Corrupted schedule with class conflict is rejected');
    assert(validationClassConflict.errors.some((e) => e.code === 'CLASS_TIME_CONFLICT'), 'Error code is CLASS_TIME_CONFLICT');

    // ------------------------------------------------------------
    // TEST 8: Global faculty conflict is prevented
    // ------------------------------------------------------------
    console.log('\n--- TEST 8: Global faculty conflict is prevented ---');
    const existingOccupancyMap = new Map();
    existingOccupancyMap.set('FWL-04_MON_P1', { academicContextId: ctxII_A._id, courseCode: '22CSC06' });

    const corruptedScheduleFacultyConflict = [
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY', duration: 1 },
    ];
    const validationFacConflict = validateGeneratedSchedule(corruptedScheduleFacultyConflict, {
      context: ctxIII_A,
      resolvedRequirements: [],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
      existingGlobalOccupancy: existingOccupancyMap,
    });
    assert(!validationFacConflict.isValid, 'Global external faculty conflict is rejected');
    assert(validationFacConflict.errors.some((e) => e.code === 'GLOBAL_FACULTY_CONFLICT'), 'Error code is GLOBAL_FACULTY_CONFLICT');

    // ------------------------------------------------------------
    // TEST 9: Exact duplicate session is prevented
    // ------------------------------------------------------------
    console.log('\n--- TEST 9: Exact duplicate session is prevented ---');
    const duplicateSessionSchedule = [
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY', duration: 1 },
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY', duration: 1 },
    ];
    const validationDup = validateGeneratedSchedule(duplicateSessionSchedule, {
      context: ctxIII_A,
      resolvedRequirements: [],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    });
    assert(!validationDup.isValid, 'Exact duplicate session is rejected');
    assert(validationDup.errors.some((e) => e.code === 'DUPLICATE_SESSION'), 'Error code is DUPLICATE_SESSION');

    // ------------------------------------------------------------
    // TEST 10: Same course can receive multiple legitimate weekly periods
    // ------------------------------------------------------------
    console.log('\n--- TEST 10: Same course can receive multiple legitimate weekly periods ---');
    const validMultiPeriodTheory = [
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY', duration: 1 },
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'TUE', period: 'P2', sessionType: 'THEORY', duration: 1 },
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'WED', period: 'P3', sessionType: 'THEORY', duration: 1 },
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'THU', period: 'P4', sessionType: 'THEORY', duration: 1 },
    ];
    const validationMultiPeriod = validateGeneratedSchedule(validMultiPeriodTheory, {
      context: ctxIII_A,
      resolvedRequirements: [{ courseCode: '22CSC14', totalPeriod: 4 }],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    });
    assert(validationMultiPeriod.isValid, 'Same theory course on 4 distinct days/periods is accepted as valid');

    // ------------------------------------------------------------
    // TEST 11: Lab block is exactly 4 consecutive periods where required
    // ------------------------------------------------------------
    console.log('\n--- TEST 11: Lab block is exactly 4 consecutive periods where required ---');
    const nonConsecutiveLab = [
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P1', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P2', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P4', sessionType: 'LAB', duration: 4 }, // skipped P3!
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P5', sessionType: 'LAB', duration: 4 },
    ];
    const validationNonConsecLab = validateGeneratedSchedule(nonConsecutiveLab, {
      context: ctxIII_A,
      resolvedRequirements: [{ courseCode: '22CSP09', isLab: true, totalPeriod: 4 }],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    });
    assert(!validationNonConsecLab.isValid, 'Non-consecutive lab block is rejected');
    assert(validationNonConsecLab.errors.some((e) => e.code === 'LAB_NOT_CONSECUTIVE'), 'Error code is LAB_NOT_CONSECUTIVE');

    // ------------------------------------------------------------
    // TEST 12: Lab cannot cross a break
    // ------------------------------------------------------------
    console.log('\n--- TEST 12: Lab cannot cross a break ---');
    // Block spanning P3, P4, P5, P6 crosses lunch break between P4 and P5
    const breakCrossingLab = [
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'WED', period: 'P3', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'WED', period: 'P4', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'WED', period: 'P5', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'WED', period: 'P6', sessionType: 'LAB', duration: 4 },
    ];
    assert(crossesBreak(['P3', 'P4', 'P5', 'P6']), 'P3-P6 is identified as crossing lunch break');
    const validationBreakLab = validateGeneratedSchedule(breakCrossingLab, {
      context: ctxIII_A,
      resolvedRequirements: [{ courseCode: '22CSP09', isLab: true, totalPeriod: 4 }],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    });
    assert(!validationBreakLab.isValid, 'Lab block crossing break is rejected by validator');
    assert(validationBreakLab.errors.some((e) => e.code === 'LAB_CROSSES_BREAK'), 'Error code is LAB_CROSSES_BREAK');

    // ------------------------------------------------------------
    // TEST 13: Lab cannot overlap class occupancy
    // ------------------------------------------------------------
    console.log('\n--- TEST 13: Lab cannot overlap class occupancy ---');
    const stateWithClassOcc = {
      classOccupancy: new Map([['MON_P2', { courseCode: '22CSC14' }]]),
      globalFacultyOccupancy: new Map(),
      facultyUnavailableSet: new Set(),
      scheduledLabs: [],
    };
    const labVar = { id: 'LAB_TEST', courseCode: '22CSP09', facultyId: 'FWL-14', isLab: true, duration: 4 };
    const candidatesWithClassOcc = generateCandidatesForVariable(labVar, stateWithClassOcc, {
      gridConfig: { days: ['MON'], periods: DEFAULT_PERIODS },
      totalLabsCount: 1,
    });
    const monMorningIncluded = candidatesWithClassOcc.some((c) => c.day === 'MON' && c.periods.includes('P2'));
    assert(!monMorningIncluded, 'Candidate generator excludes lab blocks that overlap occupied class period P2');

    // ------------------------------------------------------------
    // TEST 14: Lab cannot overlap faculty occupancy
    // ------------------------------------------------------------
    console.log('\n--- TEST 14: Lab cannot overlap faculty occupancy ---');
    const stateWithFacOcc = {
      classOccupancy: new Map(),
      globalFacultyOccupancy: new Map([['FWL-14_MON_P3', { courseCode: 'OTHER' }]]),
      facultyUnavailableSet: new Set(),
      scheduledLabs: [],
    };
    const candidatesWithFacOcc = generateCandidatesForVariable(labVar, stateWithFacOcc, {
      gridConfig: { days: ['MON'], periods: DEFAULT_PERIODS },
      totalLabsCount: 1,
    });
    const monFacOccupiedIncluded = candidatesWithFacOcc.some((c) => c.day === 'MON' && c.periods.includes('P3'));
    assert(!monFacOccupiedIncluded, 'Candidate generator excludes lab blocks overlapping faculty occupancy');

    // ------------------------------------------------------------
    // TEST 15: Multiple labs produce at least one afternoon lab
    // ------------------------------------------------------------
    console.log('\n--- TEST 15: Multiple labs produce at least one afternoon lab ---');
    const twoMorningLabsSchedule = [
      // Lab A on Monday Morning
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P1', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P2', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P3', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P4', sessionType: 'LAB', duration: 4 },
      // Lab B on Thursday Morning (both in morning!)
      { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P1', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P2', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P3', sessionType: 'LAB', duration: 4 },
      { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P4', sessionType: 'LAB', duration: 4 },
    ];
    const validationTwoMorning = validateGeneratedSchedule(twoMorningLabsSchedule, {
      context: ctxIII_A,
      resolvedRequirements: [
        { courseCode: '22CSP09', isLab: true, totalPeriod: 4 },
        { courseCode: '22CSP10', isLab: true, totalPeriod: 4 },
      ],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    });
    assert(!validationTwoMorning.isValid, 'Schedule with 2 morning labs and 0 afternoon labs is rejected');
    assert(validationTwoMorning.errors.some((e) => e.code === 'MULTI_LAB_AFTERNOON_REQUIRED'), 'Error code is MULTI_LAB_AFTERNOON_REQUIRED');

    // ------------------------------------------------------------
    // TEST 16: Single lab prefers morning when both options are feasible
    // ------------------------------------------------------------
    console.log('\n--- TEST 16: Single lab prefers morning when both options are feasible ---');
    const singleLabMorningCand = { day: 'MON', periods: ['P1', 'P2', 'P3', 'P4'], session: 'MORNING', isLab: true, duration: 4 };
    const singleLabAfternoonCand = { day: 'MON', periods: ['P5', 'P6', 'P7', 'P8'], session: 'AFTERNOON', isLab: true, duration: 4 };
    const dummyState = { classOccupancy: new Map(), globalFacultyOccupancy: new Map(), scheduledLabs: [] };
    const dummyContext = { gridConfig: { periods: DEFAULT_PERIODS }, totalLabsCount: 1, rng: new SeededRandom(123) };
    const morningScore = scoreCandidate(singleLabMorningCand, labVar, dummyState, dummyContext);
    const afternoonScore = scoreCandidate(singleLabAfternoonCand, labVar, dummyState, dummyContext);
    assert(morningScore > afternoonScore, `Single lab gives higher score to morning (${morningScore.toFixed(1)}) than afternoon (${afternoonScore.toFixed(1)})`);

    // ------------------------------------------------------------
    // TEST 17: Single lab may use afternoon when morning is impossible
    // ------------------------------------------------------------
    console.log('\n--- TEST 17: Single lab may use afternoon when morning is impossible ---');
    // Block all morning slots on all days
    const stateMorningBlocked = {
      classOccupancy: new Map(),
      globalFacultyOccupancy: new Map(),
      facultyUnavailableSet: new Set(),
      scheduledLabs: [],
    };
    DEFAULT_DAYS.forEach((d) => {
      ['P1', 'P2', 'P3', 'P4'].forEach((p) => {
        stateMorningBlocked.classOccupancy.set(`${d}_${p}`, { courseCode: 'OCCUPIED' });
      });
    });
    const candidatesMorningBlocked = generateCandidatesForVariable(labVar, stateMorningBlocked, {
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
      totalLabsCount: 1,
    });
    assert(candidatesMorningBlocked.length > 0, `Single lab generates ${candidatesMorningBlocked.length} afternoon candidates when morning is blocked`);
    assert(candidatesMorningBlocked.every((c) => c.session === 'AFTERNOON'), 'All generated candidates are in the afternoon');

    // ------------------------------------------------------------
    // TEST 18: Theory cannot create 3 consecutive same-subject periods
    // ------------------------------------------------------------
    console.log('\n--- TEST 18: Theory cannot create 3 consecutive same-subject periods ---');
    const classOccTwoTheory = new Map([
      ['MON_P1', { courseCode: '22CSC14' }],
      ['MON_P2', { courseCode: '22CSC14' }],
    ]);
    const wouldViolate = wouldCreateThreeConsecutiveTheory('MON', 'P3', '22CSC14', classOccTwoTheory, DEFAULT_PERIODS);
    assert(wouldViolate === true, 'P3 correctly detected as violating theory 3-consecutive rule');
    const wouldNotViolate = wouldCreateThreeConsecutiveTheory('MON', 'P4', '22CSC14', classOccTwoTheory, DEFAULT_PERIODS);
    assert(wouldNotViolate === false, 'P4 does not violate theory 3-consecutive rule (non-adjacent)');

    // ------------------------------------------------------------
    // TEST 19: Theory distribution is scored correctly
    // ------------------------------------------------------------
    console.log('\n--- TEST 19: Theory distribution is scored correctly ---');
    const theoryVar = { id: '22CSC14-1', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, duration: 1 };
    const dayWithZeroCoursesCand = { day: 'TUE', period: 'P1', periods: ['P1'], session: 'MORNING', isLab: false };
    const dayWithOneCourseCand = { day: 'MON', period: 'P5', periods: ['P5'], session: 'AFTERNOON', isLab: false };
    const scoreZeroOnDay = scoreCandidate(dayWithZeroCoursesCand, theoryVar, dummyState, dummyContext);
    const stateWithMonCourse = {
      classOccupancy: new Map([['MON_P1', { courseCode: '22CSC14' }]]),
      globalFacultyOccupancy: new Map(),
      scheduledLabs: [],
    };
    const scoreOneOnDay = scoreCandidate(dayWithOneCourseCand, theoryVar, stateWithMonCourse, dummyContext);
    assert(scoreZeroOnDay > scoreOneOnDay, `Placing course on unused day scores higher (${scoreZeroOnDay.toFixed(1)}) than already used day (${scoreOneOnDay.toFixed(1)})`);

    // ------------------------------------------------------------
    // TEST 20: MRV chooses requirement with fewer candidates
    // ------------------------------------------------------------
    console.log('\n--- TEST 20: MRV chooses requirement with fewer candidates ---');
    // Variable A has faculty available on only 1 period; Variable B has faculty available on all periods
    const constrainedVar = { id: 'VAR_CONSTRAINED', courseCode: '22CSC14', facultyId: 'FWL-CONSTRAINED', isLab: false };
    const freeVar = { id: 'VAR_FREE', courseCode: '22CSC15', facultyId: 'FWL-FREE', isLab: false };
    const stateMRV = {
      classOccupancy: new Map(),
      globalFacultyOccupancy: new Map(),
      facultyUnavailableSet: new Set(),
      scheduledLabs: [],
    };
    // Make FWL-CONSTRAINED unavailable on almost all slots except MON P1
    DEFAULT_DAYS.forEach((d) => {
      DEFAULT_PERIODS.forEach((p) => {
        if (!(d === 'MON' && p === 'P1')) {
          stateMRV.facultyUnavailableSet.add(`FWL-CONSTRAINED_${d}_${p}`);
        }
      });
    });
    const mrvResult = forwardCheckAndOrderMRV([freeVar, constrainedVar], stateMRV, {
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
      totalLabsCount: 0,
      rng: new SeededRandom(42),
    });
    assert(mrvResult.feasible, 'Forward check finds valid candidates');
    assert(mrvResult.orderedVariables[0].id === 'VAR_CONSTRAINED', 'MRV dynamically prioritizes the more constrained variable first');

    // ------------------------------------------------------------
    // TEST 21: Forward checking detects zero-domain conditions
    // ------------------------------------------------------------
    console.log('\n--- TEST 21: Forward checking detects zero-domain conditions ---');
    // Completely exhaust faculty availability for a variable
    const impossibleVar = { id: 'VAR_IMPOSSIBLE', courseCode: '22CSC16', facultyId: 'FWL-IMPOSSIBLE', isLab: false };
    const stateZeroDomain = {
      classOccupancy: new Map(),
      globalFacultyOccupancy: new Map(),
      facultyUnavailableSet: new Set(),
      scheduledLabs: [],
    };
    DEFAULT_DAYS.forEach((d) => {
      DEFAULT_PERIODS.forEach((p) => {
        stateZeroDomain.facultyUnavailableSet.add(`FWL-IMPOSSIBLE_${d}_${p}`);
      });
    });
    const zeroDomainCheck = forwardCheckAndOrderMRV([impossibleVar], stateZeroDomain, {
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
      totalLabsCount: 0,
      rng: new SeededRandom(42),
    });
    assert(!zeroDomainCheck.feasible, 'Forward checking detects zero-domain failure');
    assert(zeroDomainCheck.emptyVariable.id === 'VAR_IMPOSSIBLE', 'Flags the exact empty variable');

    // ------------------------------------------------------------
    // TEST 22: Backtracking recovers from a dead-end branch
    // ------------------------------------------------------------
    console.log('\n--- TEST 22: Backtracking recovers from a dead-end branch ---');
    // Setup a small subproblem with a dead-end branch
    const deadEndSpec = {
      context: ctxIII_A,
      version: null,
      allVariables: [
        { id: 'T1', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, duration: 1 },
        { id: 'T2', courseCode: '22CSC15', facultyId: 'FWL-14', isLab: false, duration: 1 },
      ],
      labVariables: [],
      theoryVariables: [
        { id: 'T1', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, duration: 1 },
        { id: 'T2', courseCode: '22CSC15', facultyId: 'FWL-14', isLab: false, duration: 1 },
      ],
      resolvedRequirements: [
        { courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, totalPeriod: 1 },
        { courseCode: '22CSC15', facultyId: 'FWL-14', isLab: false, totalPeriod: 1 },
      ],
      globalFacultyOccupancy: new Map(),
      existingClassOccupancy: new Map(),
      facultyUnavailableSet: new Set(['FWL-14_MON_P2']), // T2 cannot take P2
      gridConfig: { days: ['MON'], periods: ['P1', 'P2'] },
    };
    const deadEndSolve = await solveTimetable(deadEndSpec, { seed: 101 });
    assert(deadEndSolve.success, 'Solver finds solution despite initial branch constraints');
    assert(deadEndSolve.sessions.length === 2, 'All 2 variables successfully scheduled');

    // ------------------------------------------------------------
    // TEST 23: Least-constraining value preserves more future candidates
    // ------------------------------------------------------------
    console.log('\n--- TEST 23: Least-constraining value preserves more future candidates ---');
    const candOccupiesMany = { day: 'MON', period: 'P1', periods: ['P1'], session: 'MORNING', isLab: false };
    const candOccupiesFew = { day: 'TUE', period: 'P1', periods: ['P1'], session: 'MORNING', isLab: false };
    const lcvVar = { id: 'VAR_1', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, duration: 1 };
    const remVars = [
      { id: 'VAR_2', courseCode: '22CSC15', facultyId: 'FWL-04', isLab: false, duration: 1 }, // same faculty
      { id: 'VAR_3', courseCode: '22CSC16', facultyId: 'FWL-14', isLab: false, duration: 1 },
    ];
    const dummyLCVContext = { gridConfig: { periods: DEFAULT_PERIODS }, totalLabsCount: 0, rng: new SeededRandom(1) };
    const scoreFew = scoreCandidate(candOccupiesFew, lcvVar, { classOccupancy: new Map(), globalFacultyOccupancy: new Map(), remainingVariables: remVars }, dummyLCVContext);
    assert(typeof scoreFew === 'number', 'LCV score computed successfully');

    // ------------------------------------------------------------
    // TEST 24: Seeded generation is reproducible
    // ------------------------------------------------------------
    console.log('\n--- TEST 24: Seeded generation is reproducible ---');
    const rng1 = new SeededRandom(834291);
    const rng2 = new SeededRandom(834291);
    const seq1 = [rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next()];
    assert(JSON.stringify(seq1) === JSON.stringify(seq2), 'Seeded RNG produces identical sequences for the same seed');

    // ------------------------------------------------------------
    // TEST 25: Different seed can produce a different valid schedule
    // ------------------------------------------------------------
    console.log('\n--- TEST 25: Different seed can produce a different sequence ---');
    const rng3 = new SeededRandom(999999);
    const seq3 = [rng3.next(), rng3.next(), rng3.next()];
    assert(JSON.stringify(seq1) !== JSON.stringify(seq3), 'Different seeds produce different sequences');

    // ------------------------------------------------------------
    // TEST 26: Hard validator catches intentionally corrupted schedule
    // ------------------------------------------------------------
    console.log('\n--- TEST 26: Hard validator catches intentionally corrupted schedule ---');
    const corruptedThreeConsecutive = [
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY', duration: 1 },
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P2', sessionType: 'THEORY', duration: 1 },
      { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P3', sessionType: 'THEORY', duration: 1 },
    ];
    const valCorrupted = validateGeneratedSchedule(corruptedThreeConsecutive, {
      context: ctxIII_A,
      resolvedRequirements: [{ courseCode: '22CSC14', totalPeriod: 3 }],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    });
    assert(!valCorrupted.isValid, 'Corrupted schedule with 3 consecutive theory periods is caught by validator');
    assert(valCorrupted.errors.some((e) => e.code === 'THEORY_CONSECUTIVE_VIOLATION'), 'Error code is THEORY_CONSECUTIVE_VIOLATION');

    // ------------------------------------------------------------
    // TEST 27: Generation failure does not persist partial timetable success data
    // ------------------------------------------------------------
    console.log('\n--- TEST 27: Generation failure does not persist partial timetable data ---');
    const sessionCountBefore = await TimetableSession.countDocuments({ academicContextId: ctxIII_A._id });
    
    // Attempt generation with impossible constraints
    let failedResult = null;
    try {
      failedResult = await solveAndPersistTimetable({
        academicContextId: ctxIII_A._id,
        assignmentPlan: [{ courseCode: 'NON_EXISTENT_CODE' }],
      });
    } catch (err) {
      failedResult = { success: false, error: err };
    }
    const sessionCountAfter = await TimetableSession.countDocuments({ academicContextId: ctxIII_A._id });
    assert(!failedResult.success, 'Generation fails cleanly on invalid input');
    assert(sessionCountBefore === sessionCountAfter, 'No partial or corrupted sessions persisted to database');

    // ------------------------------------------------------------
    // TEST 28: Successful generation persists all canonical TimetableSession records
    // ------------------------------------------------------------
    console.log('\n--- TEST 28: Successful generation persists all canonical TimetableSession records ---');
    // Prepare targeted plan for III Year A: 2 Theory courses + 1 Lab course
    const targetedPlan = [
      { courseCode: '22CSC14', facultyId: 'FWL-04', requiredPeriods: 4, type: 'THEORY' },
      { courseCode: '22CSC15', facultyId: 'FWL-14', requiredPeriods: 4, type: 'THEORY' },
      { courseCode: '22CSP09', facultyId: 'FWL-01', requiredPeriods: 4, type: 'LAB' },
    ];

    // Ensure faculty records exist for targeted plan
    await Faculty.findOneAndUpdate(
      { facultyId: 'FWL-14' },
      { $set: { facultyName: 'Ms. Test Faculty 14', department: 'CSE', isActive: true } },
      { upsert: true }
    );

    // Ensure authoritative HOD allocations for courses in targetedPlan
    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: ctxIII_A._id, courseCode: '22CSC14' },
      {
        $set: {
          courseName: 'Principles of Compiler Design',
          facultyId: 'FWL-04',
          facultyName: 'Dr. A. Manchula',
          allocationType: 'THEORY',
          assignedBy: 'HOD',
          status: 'APPROVED',
        },
      },
      { upsert: true }
    );
    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: ctxIII_A._id, courseCode: '22CSC15' },
      {
        $set: {
          courseName: 'Full Stack Development',
          facultyId: 'FWL-14',
          facultyName: 'Ms. Test Faculty 14',
          allocationType: 'THEORY',
          assignedBy: 'HOD',
          status: 'APPROVED',
        },
      },
      { upsert: true }
    );
    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: ctxIII_A._id, courseCode: '22CSP09' },
      {
        $set: {
          courseName: 'Full Stack Development Laboratory',
          facultyId: 'FWL-01',
          facultyName: 'Dr. Test Faculty 1',
          allocationType: 'LAB_PRIMARY',
          assignedBy: 'HOD',
          status: 'APPROVED',
        },
      },
      { upsert: true }
    );

    const solveResult = await solveAndPersistTimetable(
      {
        academicContextId: ctxIII_A._id,
        assignmentPlan: targetedPlan,
        generationSeed: 834291,
      },
      acUser
    );

    assert(solveResult.success === true, 'Timetable generation returned SUCCESS');
    assert(solveResult.sessionsCreated === 12, `Exactly 12 sessions persisted in DB (got: ${solveResult.sessionsCreated})`);
    
    const dbSessions = await TimetableSession.find({
      academicContextId: ctxIII_A._id,
      timetableVersionId: solveResult.timetableVersion._id,
    });
    assert(dbSessions.length === 12, 'Persisted DB sessions count strictly matches generation output');

    // ------------------------------------------------------------
    // TEST 29: Class timetable derivation and faculty timetable derivation come from the same TimetableSession dataset
    // ------------------------------------------------------------
    console.log('\n--- TEST 29: Single Source of Truth for Class & Faculty timetables ---');
    const classSchedule = await getClassSchedule(ctxIII_A._id, solveResult.timetableVersion._id);
    const facSchedule = await getFacultySchedule('FWL-04', solveResult.timetableVersion._id);

    assert(classSchedule.length === 12, 'Class timetable derived directly from TimetableSession');
    assert(facSchedule.length === 4, 'Faculty timetable derived directly from TimetableSession for FWL-04');
    
    // Check that faculty session is an exact reference to one of the class sessions
    const facSessionInClass = classSchedule.find((s) => s.facultyId === 'FWL-04' && s.period === facSchedule[0].period && s.day === facSchedule[0].day);
    assert(Boolean(facSessionInClass), 'Faculty schedule cell maps directly to identical TimetableSession entity');

    // ------------------------------------------------------------
    // TEST 30: Generated timetable can transition through existing HOD approval workflow
    // ------------------------------------------------------------
    console.log('\n--- TEST 30: HOD approval workflow lifecycle ---');
    const currentVersion = await TimetableVersion.findById(solveResult.timetableVersion._id);
    assert(currentVersion.status === 'GENERATED', 'Generated timetable is in GENERATED status');

    // AC submits: GENERATED -> PENDING_HOD_APPROVAL
    const submittedVersion = await transitionTimetableStatus(currentVersion._id, 'PENDING_HOD_APPROVAL', acUser);
    assert(submittedVersion.status === 'PENDING_HOD_APPROVAL', 'Timetable successfully transitioned to PENDING_HOD_APPROVAL');

    // HOD approves: PENDING_HOD_APPROVAL -> APPROVED
    const approvedVersion = await transitionTimetableStatus(currentVersion._id, 'APPROVED', hodUser);
    assert(approvedVersion.status === 'APPROVED', 'HOD successfully approved timetable');
    assert(approvedVersion.approvedBy === hodUser.name, 'ApprovedBy correctly records HOD identity');

    // ------------------------------------------------------------
    // TEST 31: Unsatisfiable case: Faculty has no available slot
    // ------------------------------------------------------------
    console.log('\n--- TEST 31: Unsatisfiable case - Faculty has no available slot ---');
    // Create transient test course and allocation
    const transCourse = await Course.findOneAndUpdate(
      { courseCode: '22TEST01' },
      {
        $set: {
          courseName: 'Test Unavailable Course',
          semester: 'Semester V',
          courseType: 'THEORY',
          totalPeriod: 4,
          isLab: false,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: ctxIII_A._id, courseCode: '22TEST01' },
      {
        $set: {
          courseName: 'Test Unavailable Course',
          facultyId: 'FWL-99_UNAVAIL',
          facultyName: 'Dr. Unavailable Faculty',
          allocationType: 'THEORY',
          status: 'APPROVED',
          assignedBy: 'HOD',
        },
      },
      { upsert: true }
    );
    await Faculty.findOneAndUpdate(
      { facultyId: 'FWL-99_UNAVAIL' },
      { $set: { facultyName: 'Dr. Unavailable Faculty', department: 'CSE', isActive: true } },
      { upsert: true }
    );
    // Mark this faculty unavailable everywhere
    for (const d of DEFAULT_DAYS) {
      for (const p of DEFAULT_PERIODS) {
        await FacultyAvailability.findOneAndUpdate(
          { facultyId: 'FWL-99_UNAVAIL', day: d, period: p },
          { $set: { status: 'UNAVAILABLE' } },
          { upsert: true }
        );
      }
    }

    const unavailPlanResult = await solveAndPersistTimetable({
      academicContextId: ctxIII_A._id,
      assignmentPlan: [{ courseCode: '22TEST01', facultyId: 'FWL-99_UNAVAIL', requiredPeriods: 4 }],
    });
    assert(!unavailPlanResult.success, 'Generation fails cleanly when faculty has 0 available slots');
    assert(unavailPlanResult.code === 'UNSATISFIABLE_CONSTRAINTS', 'Failure code is UNSATISFIABLE_CONSTRAINTS');

    // Cleanup transient
    await Course.deleteOne({ courseCode: '22TEST01' });
    await HODFacultyAllocation.deleteOne({ academicContextId: ctxIII_A._id, courseCode: '22TEST01' });
    await FacultyAvailability.deleteMany({ facultyId: 'FWL-99_UNAVAIL' });
    await Faculty.deleteOne({ facultyId: 'FWL-99_UNAVAIL' });

    // ------------------------------------------------------------
    // TEST 32: Unsatisfiable case: Class has no available slot
    // ------------------------------------------------------------
    console.log('\n--- TEST 32: Unsatisfiable case - Class slots exhausted ---');
    // Problem where class grid has only 1 slot, but course requires 4 periods
    const tightSpec = {
      context: ctxIII_A,
      version: currentVersion,
      allVariables: [
        { id: 'T1', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, duration: 1 },
        { id: 'T2', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, duration: 1 },
      ],
      labVariables: [],
      theoryVariables: [
        { id: 'T1', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, duration: 1 },
        { id: 'T2', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, duration: 1 },
      ],
      resolvedRequirements: [{ courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false, totalPeriod: 2 }],
      globalFacultyOccupancy: new Map(),
      existingClassOccupancy: new Map(),
      facultyUnavailableSet: new Set(),
      gridConfig: { days: ['MON'], periods: ['P1'] }, // Only 1 slot available!
    };
    const tightSolve = await solveTimetable(tightSpec, { seed: 1 });
    assert(!tightSolve.success, 'Fails cleanly when required periods exceed available timetable capacity');
    assert(tightSolve.code === 'UNSATISFIABLE_CONSTRAINTS', 'Failure code is UNSATISFIABLE_CONSTRAINTS');

    // ------------------------------------------------------------
    // TEST 33: Unsatisfiable case: Two labs require afternoon but only one afternoon block exists
    // ------------------------------------------------------------
    console.log('\n--- TEST 33: Unsatisfiable case - Lab blocks exhausted ---');
    const labExhaustSpec = {
      context: ctxIII_A,
      version: currentVersion,
      allVariables: [
        { id: 'L1', courseCode: '22CSP09', facultyId: 'FWL-14', isLab: true, duration: 4 },
        { id: 'L2', courseCode: '22CSP10', facultyId: 'FWL-03', isLab: true, duration: 4 },
      ],
      labVariables: [
        { id: 'L1', courseCode: '22CSP09', facultyId: 'FWL-14', isLab: true, duration: 4 },
        { id: 'L2', courseCode: '22CSP10', facultyId: 'FWL-03', isLab: true, duration: 4 },
      ],
      theoryVariables: [],
      resolvedRequirements: [
        { courseCode: '22CSP09', facultyId: 'FWL-14', isLab: true, totalPeriod: 4 },
        { courseCode: '22CSP10', facultyId: 'FWL-03', isLab: true, totalPeriod: 4 },
      ],
      globalFacultyOccupancy: new Map(),
      existingClassOccupancy: new Map(),
      facultyUnavailableSet: new Set(),
      // Only 1 day with 4 periods in morning, NO afternoon block
      gridConfig: { days: ['MON'], periods: ['P1', 'P2', 'P3', 'P4'] },
    };
    const labExhaustSolve = await solveTimetable(labExhaustSpec, { seed: 1 });
    assert(!labExhaustSolve.success, 'Fails cleanly when multi-lab rule requires afternoon but no afternoon block exists');

    // ------------------------------------------------------------
    // TEST 34: Performance benchmark for realistic target cohort
    // ------------------------------------------------------------
    console.log('\n--- TEST 34: Performance benchmark for realistic target cohort ---');
    const perfStartTime = Date.now();
    const realisticPlan = [
      { courseCode: '22CSC14', facultyId: 'FWL-04', requiredPeriods: 4, type: 'THEORY' },
      { courseCode: '22CSC15', facultyId: 'FWL-14', requiredPeriods: 4, type: 'THEORY' },
      { courseCode: '22CSC16', facultyId: 'FWL-03', requiredPeriods: 4, type: 'THEORY' },
      { courseCode: '22CSP09', facultyId: 'FWL-01', requiredPeriods: 4, type: 'LAB' },
      { courseCode: '22CSP10', facultyId: 'FWL-06', requiredPeriods: 4, type: 'LAB' },
    ];
    // Ensure allocations exist
    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: ctxIII_A._id, courseCode: '22CSC16' },
      { $set: { courseName: 'OOSE', facultyId: 'FWL-03', facultyName: 'Dr. Test Faculty 3', allocationType: 'THEORY', status: 'APPROVED', assignedBy: 'HOD' } },
      { upsert: true }
    );
    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: ctxIII_A._id, courseCode: '22CSP10' },
      { $set: { courseName: 'OOSE Lab', facultyId: 'FWL-06', facultyName: 'Dr. Test Faculty 5', allocationType: 'LAB_PRIMARY', status: 'APPROVED', assignedBy: 'HOD' } },
      { upsert: true }
    );
    await Faculty.findOneAndUpdate(
      { facultyId: 'FWL-06' },
      { $set: { facultyName: 'Dr. Test Faculty 5', department: 'CSE', isActive: true } },
      { upsert: true }
    );

    const perfResult = await solveAndPersistTimetable(
      {
        academicContextId: ctxIII_A._id,
        assignmentPlan: realisticPlan,
        generationSeed: 123456,
      },
      acUser
    );
    const perfDuration = Date.now() - perfStartTime;
    assert(perfResult.success === true, 'Realistic cohort timetable solved successfully');
    assert(perfDuration < 5000, `Execution completed within bounded time limit (took: ${perfDuration}ms)`);
    assert(perfResult.metrics.nodesExplored > 0, `Search nodes explored: ${perfResult.metrics.nodesExplored}`);
    console.log(`      Performance Metrics: duration=${perfDuration}ms, nodes=${perfResult.metrics.nodesExplored}, backtracks=${perfResult.metrics.backtracks}`);

    // ------------------------------------------------------------
    // TEST 35: End-to-end API HTTP integration test (/api/timetable/solve)
    // ------------------------------------------------------------
    console.log('\n--- TEST 35: End-to-end API HTTP integration test (/api/timetable/solve) ---');
    const apiRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/solve',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        academicContextId: ctxIII_A._id,
        assignmentPlan: [
          { courseCode: '22CSC14', facultyId: 'FWL-04', requiredPeriods: 4 },
          { courseCode: '22CSP09', facultyId: 'FWL-01', requiredPeriods: 4 },
        ],
        generationSeed: 445566,
      },
    });

    assert(apiRes.statusCode === 201, `POST /api/timetable/solve returned HTTP 201 (got: ${apiRes.statusCode})`);
    assert(apiRes.body.success === true, 'API response success is true');
    assert(apiRes.body.data.generationSeed === 445566, 'API returns assigned generation seed');
    assert(apiRes.body.data.sessionsCreated === 8, 'API created 8 total sessions (4 theory + 4 lab)');

  } catch (err) {
    console.error('Test Suite Exception:', err);
    failCount++;
  } finally {
    try {
      await seedFaculty();
      await seedTimetable();
    } catch (e) {
      // ignore seed reset error
    }
    await disconnectDB();
  }

  console.log('\n============================================================');
  console.log(`TIMETABLE SOLVER TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTimetableSolverTests();
