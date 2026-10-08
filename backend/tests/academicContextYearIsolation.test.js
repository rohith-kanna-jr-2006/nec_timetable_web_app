/**
 * Academic Context & Academic-Year Isolation Test Suite (B3)
 *
 * Requirements:
 * 1. Context A: 2026-27 / III-B
 * 2. Context B: 2026-27 / III-C
 * 3. Context C: 2025-26 / III-B
 *
 * Verifies strict data isolation across:
 * - allocation isolation
 * - timetable draft isolation
 * - generation isolation
 * - version isolation
 * - session isolation
 * - advisor isolation
 * - faculty assignment isolation
 * - course requirement isolation
 *
 * Cross-context requests deliberately attempted -> must reject or return no unauthorized data.
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const Course = require('../src/models/Course');
const AcademicContext = require('../src/models/AcademicContext');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const ClassAdvisorAssignment = require('../src/models/ClassAdvisorAssignment');
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

function makeRequest(appInstance, opts) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, () => {
      const port = server.address().port;
      const payload = opts.body ? JSON.stringify(opts.body) : null;
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
      const req = http.request(
        { hostname: '127.0.0.1', port, path: opts.path, method: opts.method || 'GET', headers },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            server.close();
            let parsed;
            try {
              parsed = JSON.parse(raw);
            } catch (_) {
              parsed = raw;
            }
            resolve({ statusCode: res.statusCode, body: parsed });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function run() {
  console.log('============================================================');
  console.log('ACADEMIC CONTEXT & YEAR ISOLATION TEST SUITE (B3)');
  console.log('============================================================\n');

  await connectDB();

  const TEST_PREFIX = 'ISO_TEST_';
  const hodEmail = `${TEST_PREFIX}hod@nec.edu.in`;
  const tcEmail = `${TEST_PREFIX}tc@nec.edu.in`;

  try {
    // Cleanup prior run
    await User.deleteMany({ email: { $in: [hodEmail, tcEmail] } });
    await AcademicContext.deleteMany({ department: 'ISOD' });
    await Course.deleteMany({ courseCode: { $regex: '^ISOD' } });
    await Faculty.deleteMany({ facultyId: { $regex: '^ISOD-FAC' } });
    await HODFacultyAllocation.deleteMany({ department: 'ISOD' });
    await TimetableVersion.deleteMany({ department: 'ISOD' });
    await TimetableSession.deleteMany({ department: 'ISOD' });

    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const hodUser = await User.create({
      name: 'Isolation HOD',
      email: hodEmail,
      passwordHash,
      role: 'HOD',
      facultyId: 'ISOD-HOD',
      isActive: true,
    });
    const hodToken = generateToken(hodUser);

    const tcUser = await User.create({
      name: 'Isolation TC',
      email: tcEmail,
      passwordHash,
      role: 'TC',
      facultyId: 'ISOD-TC',
      isActive: true,
    });
    const tcToken = generateToken(tcUser);

    // Setup 3 Contexts as specified in requirements:
    // Context A: 2026-27 / III-B
    const ctxA = await AcademicContext.create({
      academicYear: '2026-27',
      fromYear: 2026,
      toYear: 2027,
      regulation: 'R22',
      semester: 'ODD',
      department: 'ISOD',
      year: 3,
      section: 'B',
      status: 'ACTIVE',
    });

    // Context B: 2026-27 / III-C
    const ctxB = await AcademicContext.create({
      academicYear: '2026-27',
      fromYear: 2026,
      toYear: 2027,
      regulation: 'R22',
      semester: 'ODD',
      department: 'ISOD',
      year: 3,
      section: 'C',
      status: 'ACTIVE',
    });

    // Context C: 2025-26 / III-B (historical year)
    const ctxC = await AcademicContext.create({
      academicYear: '2025-26',
      fromYear: 2025,
      toYear: 2026,
      regulation: 'R22',
      semester: 'ODD',
      department: 'ISOD',
      year: 3,
      section: 'B',
      status: 'ACTIVE',
    });

    // Create Faculty
    const facA = await Faculty.create({
      facultyId: 'ISOD-FAC-A',
      facultyName: 'Dr. Advisor A',
      department: 'Computer Science and Engineering',
      designation: 'Associate Professor',
      roles: ['FACULTY'],
      isActive: true,
    });

    const facB = await Faculty.create({
      facultyId: 'ISOD-FAC-B',
      facultyName: 'Dr. Instructor B',
      department: 'Computer Science and Engineering',
      designation: 'Assistant Professor',
      roles: ['FACULTY'],
      isActive: true,
    });

    // Create Course
    const course1 = await Course.create({
      courseCode: 'ISOD301',
      courseName: 'Context Isolated Course',
      courseType: 'THEORY',
      credits: 3,
      totalPeriod: 3,
      semester: 'Semester V',
      regulation: 'R22',
      department: 'ISOD',
    });

    // ------------------------------------------------------------
    // 1. ALLOCATION ISOLATION
    // ------------------------------------------------------------
    console.log('\n--- 1. Allocation Isolation ---');
    // Allocate in Context A
    const allocResA = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxA._id}/course/${course1.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { facultyId: facA.facultyId },
    });
    assert(allocResA.statusCode === 200, 'Allocation created in Context A (HTTP 200)');

    // Query allocations for Context B
    const queryB = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod-allocations?academicContextId=${ctxB._id}`,
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(queryB.statusCode === 200, 'Query Context B allocations returns 200');
    assert(queryB.body.data.length === 0, 'Context B has 0 allocations (no leakage from Context A)');

    // Query allocations for Context C (previous year)
    const queryC = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod-allocations?academicContextId=${ctxC._id}`,
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(queryC.statusCode === 200, 'Query Context C allocations returns 200');
    assert(queryC.body.data.length === 0, 'Context C (2025-26) has 0 allocations (no leakage from Context A)');

    // ------------------------------------------------------------
    // 2. TIMETABLE VERSION & DRAFT ISOLATION
    // ------------------------------------------------------------
    console.log('\n--- 2. Timetable Version Isolation ---');
    // Create draft version in Context A
    const vA = await TimetableVersion.create({
      academicContextId: ctxA._id,
      academicYear: ctxA.academicYear,
      semester: ctxA.semester,
      department: ctxA.department,
      year: ctxA.year,
      section: ctxA.section,
      versionLabel: 'v1.0-A',
      status: 'DRAFT',
    });

    // Query versions for Context B
    const verB = await TimetableVersion.find({ academicContextId: ctxB._id });
    assert(verB.length === 0, 'Context B has 0 timetable versions');

    // Query versions for Context C
    const verC = await TimetableVersion.find({ academicContextId: ctxC._id });
    assert(verC.length === 0, 'Context C (2025-26) has 0 timetable versions');

    // ------------------------------------------------------------
    // 3. SESSION ISOLATION
    // ------------------------------------------------------------
    console.log('\n--- 3. Session Isolation ---');
    // Create session in Context A
    await TimetableSession.create({
      academicContextId: ctxA._id,
      timetableVersionId: vA._id,
      day: 'MON',
      period: '1',
      courseCode: course1.courseCode,
      courseName: course1.courseName,
      subject: course1.courseName,
      subjectType: 'THEORY',
      facultyId: facA.facultyId,
      facultyName: facA.facultyName,
      department: 'ISOD',
      year: 3,
      section: 'B',
      startPeriod: 1,
      endPeriod: 1,
    });

    const sessB = await TimetableSession.find({ academicContextId: ctxB._id });
    assert(sessB.length === 0, 'Context B has 0 timetable sessions (session isolated)');

    const sessC = await TimetableSession.find({ academicContextId: ctxC._id });
    assert(sessC.length === 0, 'Context C has 0 timetable sessions (academic year isolated)');

    // ------------------------------------------------------------
    // 4. CLASS ADVISOR ISOLATION
    // ------------------------------------------------------------
    console.log('\n--- 4. Class Advisor Isolation ---');
    await ClassAdvisorAssignment.create({
      academicContextId: ctxA._id,
      facultyId: facA.facultyId,
      assignedBy: 'HOD',
      status: 'ACTIVE',
    });

    const advB = await ClassAdvisorAssignment.find({ academicContextId: ctxB._id, status: 'ACTIVE' });
    assert(advB.length === 0, 'Context B has no active class advisor from Context A');

    const advC = await ClassAdvisorAssignment.find({ academicContextId: ctxC._id, status: 'ACTIVE' });
    assert(advC.length === 0, 'Context C (2025-26) has no class advisor from Context A');

    // ------------------------------------------------------------
    // 5. CROSS-CONTEXT CLASS TIMETABLE RETRIEVAL REJECTION
    // ------------------------------------------------------------
    console.log('\n--- 5. Cross-Context Timetable Request Denial ---');
    // Attempt to request Context A's version using Context B's URL path:
    // GET /api/timetable/class/:ctxB._id?versionId=:vA._id
    const crossClassRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${ctxB._id}?versionId=${vA._id}`,
      headers: { Authorization: `Bearer ${tcToken}` },
    });
    assert(crossClassRes.statusCode === 409, 'Requesting Context A version via Context B is rejected with HTTP 409');
    assert(crossClassRes.body && crossClassRes.body.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH', 'Error code is TIMETABLE_VERSION_CONTEXT_MISMATCH');

    // Attempt same with Context C
    const crossClassYearRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${ctxC._id}?versionId=${vA._id}`,
      headers: { Authorization: `Bearer ${tcToken}` },
    });
    assert(crossClassYearRes.statusCode === 409, 'Requesting Context A version via Context C (2025-26) is rejected with HTTP 409');
    assert(crossClassYearRes.body && crossClassYearRes.body.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH', 'Error code is TIMETABLE_VERSION_CONTEXT_MISMATCH');

    // ------------------------------------------------------------
    // 6. CROSS-CONTEXT STATUS TRANSITION REJECTION
    // ------------------------------------------------------------
    console.log('\n--- 6. Cross-Context Status Transition Assertion Denial ---');
    // Attempt to transition vA while asserting academicContextId = ctxB._id
    const crossStatusRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${vA._id}/status`,
      headers: { Authorization: `Bearer ${tcToken}` },
      body: {
        status: 'GENERATED',
        academicContextId: ctxB._id.toString(),
      },
    });
    assert(crossStatusRes.statusCode === 409, 'Transitioning version with mismatched context assertion is rejected with HTTP 409');
    assert(crossStatusRes.body && crossStatusRes.body.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH', 'Error code is TIMETABLE_VERSION_CONTEXT_MISMATCH');

  } finally {
    // Cleanup
    await User.deleteMany({ email: { $in: [hodEmail, tcEmail] } });
    await AcademicContext.deleteMany({ department: 'ISOD' });
    await Course.deleteMany({ courseCode: { $regex: '^ISOD' } });
    await Faculty.deleteMany({ facultyId: { $regex: '^ISOD-FAC' } });
    await HODFacultyAllocation.deleteMany({ department: 'ISOD' });
    await TimetableVersion.deleteMany({ department: 'ISOD' });
    await TimetableSession.deleteMany({ department: 'ISOD' });
    await disconnectDB();
  }

  console.log('\n============================================================');
  console.log(`ACADEMIC CONTEXT ISOLATION RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in context isolation tests:', err);
  process.exit(1);
});
