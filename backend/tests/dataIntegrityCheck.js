/**
 * Phase L: Performance and Data Integrity Check
 */

require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/db');
const Faculty = require('../src/models/Faculty');
const FacultyWorkload = require('../src/models/FacultyWorkload');
const Course = require('../src/models/Course');
const TimetableSession = require('../src/models/TimetableSession');
const TimetableVersion = require('../src/models/TimetableVersion');

async function runIntegrityCheck() {
  console.log('============================================================');
  console.log('PHASE L: PERFORMANCE & DATA INTEGRITY AUDIT');
  console.log('============================================================\n');

  await connectDB();

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

  try {
    // 1. Check duplicate faculty IDs
    const facultyDupes = await Faculty.aggregate([
      { $group: { _id: '$facultyId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    assert(facultyDupes.length === 0, `Zero duplicate faculty IDs in Faculty collection (found: ${facultyDupes.length})`);

    // 2. Check duplicate workload records
    const workloadDupes = await FacultyWorkload.aggregate([
      { $group: { _id: '$facultyId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    assert(workloadDupes.length === 0, `Zero duplicate records in FacultyWorkload collection (found: ${workloadDupes.length})`);

    // 3. Check orphan workload records (workload without faculty)
    const facultyIds = new Set((await Faculty.find({}, { facultyId: 1 })).map((f) => f.facultyId));
    const workloads = await FacultyWorkload.find({}, { facultyId: 1 });
    const orphanWorkloads = workloads.filter((w) => !facultyIds.has(w.facultyId));
    assert(orphanWorkloads.length === 0, `Zero orphan workloads without Faculty parent (found: ${orphanWorkloads.length})`);

    // 4. Check duplicate course codes
    const courseDupes = await Course.aggregate([
      { $group: { _id: '$courseCode', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    assert(courseDupes.length === 0, `Zero duplicate course codes in Course collection (found: ${courseDupes.length})`);

    // 5. Check obsolete mock codes
    const obsoleteCourses = await Course.find({ courseCode: { $in: ['26CSC01', '26CSP01'] } });
    assert(obsoleteCourses.length === 0, `Zero obsolete mock course codes (26CSC01, 26CSP01) exist (found: ${obsoleteCourses.length})`);

    // 6. Check Timetable session faculty references
    const sessions = await TimetableSession.find({}, { facultyId: 1, courseCode: 1 });
    const allCourseCodes = new Set((await Course.find({}, { courseCode: 1 })).map((c) => c.courseCode));
    const invalidSessionFaculty = sessions.filter((s) => !facultyIds.has(s.facultyId));
    assert(invalidSessionFaculty.length === 0, `All timetable sessions reference valid faculty IDs (invalid: ${invalidSessionFaculty.length})`);

    // 7. Check Timetable session course references for credit curriculum sessions (THEORY, LAB, PBL)
    const creditSessions = await TimetableSession.find({ sessionType: { $in: ['THEORY', 'LAB', 'PBL'] } });
    const invalidCreditCourses = creditSessions.filter((s) => s.courseCode && !allCourseCodes.has(s.courseCode));
    assert(invalidCreditCourses.length === 0, `All credit curriculum timetable sessions reference valid course codes (invalid: ${invalidCreditCourses.length})`);

    // 8. Workload calculations integrity across all faculty workloads
    const allWorkloads = await FacultyWorkload.find({});
    let calcMismatchCount = 0;
    for (const wl of allWorkloads) {
      let thSum = 0;
      for (const cat of ['ugTheory1', 'ugTheory2', 'lab1', 'lab2', 'pg', 'others']) {
        if (Array.isArray(wl.teaching?.[cat])) {
          for (const item of wl.teaching[cat]) {
            thSum += item.hours || 0;
          }
        }
      }
      let respSum = 0;
      if (Array.isArray(wl.responsibilities)) {
        for (const item of wl.responsibilities) {
          if (typeof item.hours === 'number') {
            respSum += item.hours;
          }
        }
      }
      if (wl.calculatedTeachingHours !== thSum || wl.calculatedResponsibilityHours !== respSum) {
        calcMismatchCount++;
      }
    }
    assert(calcMismatchCount === 0, `Zero mathematical mismatches in calculated workload hours across all records (mismatches: ${calcMismatchCount})`);

    console.log('\n============================================================');
    console.log(`DATA INTEGRITY AUDIT: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[Integrity Audit Error]', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runIntegrityCheck();
}

module.exports = { runIntegrityCheck };
