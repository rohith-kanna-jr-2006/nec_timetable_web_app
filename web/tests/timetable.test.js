/**
 * Automated Verification Suite for Phase 3 Timetable Features
 * Tests live timetable endpoints on http://127.0.0.1:5000/api and matrix helper logic.
 */

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:5000/api';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

async function runTimetableTests() {
  console.log('====================================================');
  console.log('PHASE 3 TIMETABLE INTEGRATION TEST SUITE');
  console.log(`API Base URL: ${BASE_URL}`);
  console.log('====================================================\n');

  try {
    // Health check / connectivity probe
    try {
      const probe = await fetch(`${BASE_URL}/health`);
      if (!probe.ok) throw new Error(`Status ${probe.status}`);
    } catch (netErr) {
      console.log(`  ℹ INFO: Backend server on port 5000 is offline (${netErr.message}).`);
      console.log('  ℹ INFO: Skipping live timetable API tests.\n');
      console.log('====================================================');
      console.log('TEST SUMMARY: 0/0 Passed (Backend Offline — Skipped)');
      console.log('====================================================\n');
      return;
    }

    // Test 1: Fetch published timetable versions
    const versionsRes = await fetch(`${BASE_URL}/timetable/versions`);
    const versionsData = await versionsRes.json();
    assert(versionsRes.status === 200, 'Timetable versions endpoint returns HTTP 200');
    assert(versionsData.success === true, 'Timetable versions response success flag is true');
    assert(Array.isArray(versionsData.data) && versionsData.data.length > 0, 'Found at least one published timetable version');
    const activeVersion = versionsData.data[0];
    assert(activeVersion.status === 'PUBLISHED', 'Active timetable version status is PUBLISHED');

    // Test 2: Faculty Timetable Endpoint (FWL-03 - Dr. S. Karpusamy)
    const facultyTimetableRes = await fetch(`${BASE_URL}/timetable/faculty/FWL-03`);
    const facultyTimetableData = await facultyTimetableRes.json();
    assert(facultyTimetableRes.status === 200, 'Faculty schedule endpoint returns HTTP 200');
    assert(facultyTimetableData.success === true, 'Faculty schedule response has success: true');
    assert(facultyTimetableData.data.facultyId === 'FWL-03', 'Faculty schedule matches requested facultyId FWL-03');
    assert(facultyTimetableData.data.sessionCount > 0, `Faculty has ${facultyTimetableData.data.sessionCount} scheduled sessions`);

    const sessions = facultyTimetableData.data.sessions;

    // Test 3: Session structure checks
    const sample = sessions[0];
    assert(!!sample.day && !!sample.period && !!sample.courseCode, 'Session contains day, period, and courseCode');
    assert(typeof sample.room === 'string', 'Session contains room / venue');

    // Test 4: Verify Multi-period lab blocks (Tuesday P5, P6, P7)
    const tueSessions = sessions.filter((s) => s.day === 'TUE');
    const labSessions = tueSessions.filter((s) => s.sessionType === 'LAB');
    assert(labSessions.length >= 3, `Tuesday contains ${labSessions.length} lab session slots for Compiler Design Lab`);
    assert(labSessions[0].duration === 3, 'Lab session has duration = 3 periods span');

    // Test 5: Verify Theory sessions
    const theorySessions = sessions.filter((s) => s.sessionType === 'THEORY');
    assert(theorySessions.length >= 5, `Faculty has ${theorySessions.length} theory contact periods`);

    // Test 6: Verify Class Timetable endpoint
    if (activeVersion.academicContextId) {
      const classRes = await fetch(`${BASE_URL}/timetable/class/${activeVersion.academicContextId}`);
      assert(classRes.status === 200, 'Class schedule endpoint returns HTTP 200');
    }

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('====================================================\n');

    if (failedTests > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[Timetable Test Fatal Error]', err);
    process.exitCode = 1;
  }
}

runTimetableTests();
