/**
 * Timetable Course Code / Course Name Data Integrity Test Suite
 *
 * Enforces strict alignment with docs/R22_CSE_2024_25_Onwards_Semester_Details.md:
 * - TEST 1: III Year context resolves Semester V.
 * - TEST 2: 22CSC14 resolves exact official name.
 * - TEST 3: 22CSC15 resolves exact official name.
 * - TEST 4: 22CSC16 resolves exact official name.
 * - TEST 5: 22CSP09 resolves exact official name.
 * - TEST 6: 22CSP10 resolves exact official name.
 * - TEST 7: 22MAN8R resolves exact official name.
 * - TEST 8: 22CSP04 cannot be assigned to III Year Semester V through normal curriculum generation.
 * - TEST 9: Semester III course cannot enter III Year Semester V timetable.
 * - TEST 10: Arbitrary PEC course cannot enter Semester V unless it is a valid configured elective selection.
 * - TEST 11: Review Matrix returns only sessions belonging to selected context/version.
 * - TEST 12: TimetableSession courseName matches authoritative Course.courseName.
 * - TEST 13: Generated timetable contains no invalid course identity.
 * - TEST 14: Legacy/non-academic activities are not misclassified as Semester V curriculum courses.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');

// Models
const Course = require('../src/models/Course');
const AcademicContext = require('../src/models/AcademicContext');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const Faculty = require('../src/models/Faculty');

// Validation & Service Modules
const {
  resolveContextSemester,
  validateCourseIdentity,
  isCurriculumCourse,
  validateSessionCourseIntegrity,
} = require('../src/services/timetable/courseValidator');
const {
  validateGeneratedSchedule,
} = require('../src/services/timetable/timetableValidator');
const {
  buildSchedulingContext,
  ConstraintBuilderError,
} = require('../src/services/timetable/constraintBuilder');
const {
  getClassSchedule,
} = require('../src/services/timetableService');

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

async function runCourseIntegrityTests() {
  console.log('============================================================');
  console.log('TIMETABLE COURSE CODE & COURSE NAME DATA INTEGRITY SUITE');
  console.log('============================================================\n');

  try {
    await connectDB();

    const ctxIII_A = await AcademicContext.findOne({ year: 'III Year', section: 'A' });
    const ctxII_A = await AcademicContext.findOne({ year: 'II Year', section: 'A' });

    assert(ctxIII_A !== null, 'III Year Section A academic context exists');
    assert(ctxII_A !== null, 'II Year Section A academic context exists');

    // ------------------------------------------------------------
    // TEST 1: III Year context resolves Semester V
    // ------------------------------------------------------------
    console.log('\n--- TEST 1: III Year context resolves Semester V ---');
    const semFromDoc = resolveContextSemester(ctxIII_A);
    assert(semFromDoc === 'Semester V', `ctxIII_A document resolves to Semester V (got: '${semFromDoc}')`);

    const semFromString = resolveContextSemester('III Year');
    assert(semFromString === 'Semester V', `String 'III Year' resolves to Semester V (got: '${semFromString}')`);

    const semFromUpper = resolveContextSemester('III YEAR');
    assert(semFromUpper === 'Semester V', `String 'III YEAR' resolves to Semester V (got: '${semFromUpper}')`);

    // ------------------------------------------------------------
    // TEST 2: 22CSC14 resolves exact official name
    // ------------------------------------------------------------
    console.log('\n--- TEST 2: 22CSC14 resolves exact official name ---');
    const c14 = await validateCourseIdentity('22CSC14');
    assert(c14.isValid === true, '22CSC14 is recognized in Course master');
    assert(c14.courseName === 'Principles of Compiler Design', `22CSC14 courseName is '${c14.courseName}'`);

    const c14Match = await validateCourseIdentity('22CSC14', 'Principles of Compiler Design');
    assert(c14Match.isValid === true, '22CSC14 matches exact authoritative course name');

    const c14Wrong = await validateCourseIdentity('22CSC14', 'Compiler Design Lab');
    assert(c14Wrong.isValid === false, 'Wrong course name for 22CSC14 is rejected');
    assert(c14Wrong.code === 'COURSE_NAME_MISMATCH', 'Rejection code is COURSE_NAME_MISMATCH');

    // ------------------------------------------------------------
    // TEST 3: 22CSC15 resolves exact official name (NO PBL)
    // ------------------------------------------------------------
    console.log('\n--- TEST 3: 22CSC15 resolves exact official name ---');
    const c15 = await validateCourseIdentity('22CSC15');
    assert(c15.isValid === true, '22CSC15 is recognized in Course master');
    assert(c15.courseName === 'Full Stack Development', `22CSC15 authoritative name is '${c15.courseName}'`);

    const c15PBL = await validateCourseIdentity('22CSC15', 'Full Stack Development (PBL)');
    assert(c15PBL.isValid === false, 'Mutated name with (PBL) suffix is rejected');
    assert(c15PBL.code === 'COURSE_NAME_MISMATCH', 'Rejection code is COURSE_NAME_MISMATCH');

    // ------------------------------------------------------------
    // TEST 4: 22CSC16 resolves exact official name
    // ------------------------------------------------------------
    console.log('\n--- TEST 4: 22CSC16 resolves exact official name ---');
    const c16 = await validateCourseIdentity('22CSC16');
    assert(c16.isValid === true, '22CSC16 is recognized in Course master');
    assert(c16.courseName === 'Object Oriented Software Engineering', `22CSC16 authoritative name is '${c16.courseName}'`);

    // ------------------------------------------------------------
    // TEST 5: 22CSP09 resolves exact official name
    // ------------------------------------------------------------
    console.log('\n--- TEST 5: 22CSP09 resolves exact official name ---');
    const p09 = await validateCourseIdentity('22CSP09');
    assert(p09.isValid === true, '22CSP09 is recognized in Course master');
    assert(p09.courseName === 'Full Stack Development Laboratory', `22CSP09 authoritative name is '${p09.courseName}'`);

    // ------------------------------------------------------------
    // TEST 6: 22CSP10 resolves exact official name
    // ------------------------------------------------------------
    console.log('\n--- TEST 6: 22CSP10 resolves exact official name ---');
    const p10 = await validateCourseIdentity('22CSP10');
    assert(p10.isValid === true, '22CSP10 is recognized in Course master');
    assert(p10.courseName === 'Object Oriented Software Engineering Laboratory', `22CSP10 authoritative name is '${p10.courseName}'`);

    // ------------------------------------------------------------
    // TEST 7: 22MAN8R resolves exact official name
    // ------------------------------------------------------------
    console.log('\n--- TEST 7: 22MAN8R resolves exact official name ---');
    const man8r = await validateCourseIdentity('22MAN8R');
    assert(man8r.isValid === true, '22MAN8R is recognized in Course master');
    assert(man8r.courseName === 'Soft/Analytical Skills - IV', `22MAN8R authoritative name is '${man8r.courseName}'`);

    // ------------------------------------------------------------
    // TEST 8: 22CSP04 cannot be assigned to III Year Semester V
    // ------------------------------------------------------------
    console.log('\n--- TEST 8: 22CSP04 cannot be assigned to III Year Semester V ---');
    const cCSP04 = await Course.findOne({ courseCode: '22CSP04' });
    assert(cCSP04 !== null, '22CSP04 exists in Course catalog');
    assert(cCSP04.semester === 'Semester III', `22CSP04 belongs to ${cCSP04.semester}`);

    const valCSP04 = await validateCourseIdentity('22CSP04', cCSP04.courseName, {
      academicContext: ctxIII_A,
    });
    assert(valCSP04.isValid === false, '22CSP04 rejected for III Year context');
    assert(valCSP04.code === 'COURSE_SEMESTER_MISMATCH', 'Error code is COURSE_SEMESTER_MISMATCH');

    let cbThrew = false;
    try {
      await buildSchedulingContext({
        academicContextId: ctxIII_A._id,
        assignmentPlan: [{ courseCode: '22CSP04', facultyId: 'FWL-06' }],
      });
    } catch (err) {
      cbThrew = true;
      assert(err.code === 'COURSE_SEMESTER_MISMATCH', `ConstraintBuilder rejected with ${err.code}`);
    }
    assert(cbThrew === true, 'ConstraintBuilder prevents assigning 22CSP04 to III Year');

    // ------------------------------------------------------------
    // TEST 9: Semester III course cannot enter III Year Semester V timetable
    // ------------------------------------------------------------
    console.log('\n--- TEST 9: Semester III course cannot enter III Year Semester V timetable ---');
    const sem3Sample = ['22CSC05', '22CSC06', '22CSC07', '22CSC08', '22MYB05', '22CSP05'];
    for (const code of sem3Sample) {
      const c = await Course.findOne({ courseCode: code });
      if (c) {
        const val = await validateCourseIdentity(code, c.courseName, { expectedSemester: 'Semester V' });
        assert(val.isValid === false, `Semester III course '${code}' rejected from entering Semester V`);
        assert(val.code === 'COURSE_SEMESTER_MISMATCH', `Rejection code is COURSE_SEMESTER_MISMATCH for '${code}'`);
      }
    }

    // ------------------------------------------------------------
    // TEST 10: Arbitrary PEC course cannot enter Semester V unless configured
    // ------------------------------------------------------------
    console.log('\n--- TEST 10: Arbitrary PEC cannot enter Semester V unless configured ---');
    const allowedElectives = ['22CSX42', '22CSX21'];

    const validE1 = await validateCourseIdentity('22CSX42', 'UI and UX Design', { allowedElectives });
    assert(validE1.isValid === true, 'Approved PEC 22CSX42 is accepted');

    const arbitraryPEC = await validateCourseIdentity('22CSX05', 'Computer vision', { allowedElectives });
    assert(arbitraryPEC.isValid === false, 'Unconfigured PEC 22CSX05 is rejected');
    assert(arbitraryPEC.code === 'UNCONFIGURED_ELECTIVE', 'Rejection code is UNCONFIGURED_ELECTIVE');

    // ------------------------------------------------------------
    // TEST 11: Review Matrix returns only sessions belonging to selected context/version
    // ------------------------------------------------------------
    console.log('\n--- TEST 11: Review Matrix returns only sessions for selected context/version ---');
    const iiiSessions = await getClassSchedule(ctxIII_A._id);
    assert(iiiSessions.length > 0, `III-A returned ${iiiSessions.length} canonical sessions`);

    const allMatchContext = iiiSessions.every((s) => s.academicContextId.toString() === ctxIII_A._id.toString());
    assert(allMatchContext === true, 'All returned sessions strictly match III-A academicContextId');

    const iiSessions = await getClassSchedule(ctxII_A._id);
    assert(iiSessions.length === 0, 'Context II-A with no published version returns exactly 0 sessions (no leakage)');

    // ------------------------------------------------------------
    // TEST 12: TimetableSession courseName matches authoritative Course.courseName
    // ------------------------------------------------------------
    console.log('\n--- TEST 12: TimetableSession courseName matches authoritative Course.courseName ---');
    let allCourseNamesAuthoritative = true;
    for (const s of iiiSessions) {
      if (isCurriculumCourse(s.courseCode)) {
        const c = await Course.findOne({ courseCode: s.courseCode });
        if (!c || s.courseName !== c.courseName) {
          allCourseNamesAuthoritative = false;
          console.error(`Mismatch for ${s.courseCode}: session="${s.courseName}", db="${c?.courseName}"`);
        }
      }
    }
    assert(allCourseNamesAuthoritative === true, 'All curriculum sessions match authoritative Course.courseName exactly');

    // ------------------------------------------------------------
    // TEST 13: Generated timetable contains no invalid course identity
    // ------------------------------------------------------------
    console.log('\n--- TEST 13: Generated timetable contains no invalid course identity ---');
    const mockProblemSpec = {
      context: ctxIII_A,
      expectedSemester: 'Semester V',
      resolvedRequirements: [
        { courseCode: '22CSC14', courseName: 'Principles of Compiler Design', totalPeriod: 1, isLab: false },
      ],
      hodAllocationsMap: new Map([
        ['22CSC14', { facultyId: 'FWL-04', facultyName: 'Dr. A. Manchula' }],
      ]),
      gridConfig: { days: ['MON'], periods: ['P1', 'P2'] },
    };

    const corruptedAssignments = [
      {
        courseCode: '22CSC14',
        courseName: 'Principles of Compiler Design (Mutated Suffix)',
        facultyId: 'FWL-04',
        day: 'MON',
        period: 'P1',
        sessionType: 'THEORY',
        duration: 1,
      },
    ];

    const valSchedule = validateGeneratedSchedule(corruptedAssignments, mockProblemSpec);
    assert(valSchedule.isValid === false, 'validateGeneratedSchedule rejects mutated courseName');
    assert(valSchedule.errors.some((e) => e.code === 'COURSE_NAME_MISMATCH'), 'Error contains COURSE_NAME_MISMATCH');

    // ------------------------------------------------------------
    // TEST 14: Legacy/non-academic activities not misclassified as curriculum courses
    // ------------------------------------------------------------
    console.log('\n--- TEST 14: Legacy/non-academic activities not misclassified ---');
    const legacyCodes = ['22CSS01', '22CSM01', '22CST01', '22CSL04', '22CSS02'];
    for (const code of legacyCodes) {
      assert(isCurriculumCourse(code) === false, `'${code}' is classified as non-curriculum`);
      const courseDoc = await Course.findOne({ courseCode: code });
      assert(courseDoc === null, `'${code}' is not in authoritative Course master`);
    }

    const iiiCodes = iiiSessions.map((s) => s.courseCode);
    assert(!iiiCodes.includes('22CSP04'), 'III-A review matrix contains NO 22CSP04 (Sem III lab)');
    assert(!iiiCodes.includes('22CSS01'), 'III-A review matrix contains NO 22CSS01');
    assert(!iiiCodes.includes('22CSM01'), 'III-A review matrix contains NO 22CSM01');
    assert(!iiiCodes.includes('22CST01'), 'III-A review matrix contains NO 22CST01');
    assert(!iiiCodes.includes('22CSL04'), 'III-A review matrix contains NO 22CSL04');
    assert(!iiiCodes.includes('22CSP01'), 'III-A review matrix contains NO 22CSP01');
    assert(!iiiCodes.includes('22CSS02'), 'III-A review matrix contains NO 22CSS02');

    console.log('\n============================================================');
    console.log(`COURSE INTEGRITY TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Fatal error in course integrity test runner:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runCourseIntegrityTests();
}

module.exports = { runCourseIntegrityTests };
