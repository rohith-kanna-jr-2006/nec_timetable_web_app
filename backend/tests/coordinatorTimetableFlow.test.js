/**
 * Coordinator Timetable Slot Workflow Test Suite
 *
 * Verifies all 22 authoritative requirements:
 * TEST 1: GET academic contexts -> all 12 target cohorts available.
 * TEST 2: II Year context -> Semester III course filtering works.
 * TEST 3: III Year context -> Semester V course filtering works.
 * TEST 4: IV Year context -> Semester VII course filtering works.
 * TEST 5: Existing HOD Course → Faculty allocation resolves correctly.
 * TEST 6: No HOD allocation -> scheduling rejected (409 HOD_ALLOCATION_REQUIRED).
 * TEST 7: Multiple HOD allocations -> conflict rejected (409 HOD_ALLOCATION_CONFLICT).
 * TEST 8: Coordinator submits correct HOD-assigned faculty -> session accepted if slot is free.
 * TEST 9: Coordinator submits different faculty -> rejected (409 HOD_FACULTY_MISMATCH).
 * TEST 10: Class conflict -> rejected (409 CLASS_TIME_CONFLICT).
 * TEST 11: Faculty conflict -> rejected (409 FACULTY_TIME_CONFLICT).
 * TEST 12: Exact duplicate session -> rejected (409 DUPLICATE_SESSION).
 * TEST 13: Same course on a different period -> allowed.
 * TEST 14: Same faculty on a different period -> allowed.
 * TEST 15: AC can submit: GENERATED → PENDING_HOD_APPROVAL.
 * TEST 16: AC cannot: PENDING_HOD_APPROVAL → APPROVED.
 * TEST 17: HOD can approve.
 * TEST 18: Coordinator substitute assignment is authorized according to the authoritative role model.
 * TEST 19: HOD can perform required faculty management operations.
 * TEST 20: Invalid authentication → 401.
 * TEST 21: Unauthorized role → 403.
 * TEST 22: R22 course/context integrity remains intact.
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const Course = require('../src/models/Course');
const AcademicContext = require('../src/models/AcademicContext');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const SubstituteAllocation = require('../src/models/SubstituteAllocation');
const FacultyAbsence = require('../src/models/FacultyAbsence');
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

async function runCoordinatorTimetableFlowTests() {
  console.log('============================================================');
  console.log('COORDINATOR TIMETABLE WORKFLOW & HOD ENFORCEMENT TEST SUITE');
  console.log('============================================================\n');

  try {
    await connectDB();

    // 0. Prepare test users and tokens
    const hash = await bcrypt.hash('TestPass123!', 10);
    const testUsers = [
      { name: 'Coord HOD', email: 'coord_hod@nec.edu.in', passwordHash: hash, role: 'HOD', isActive: true },
      { name: 'Coord AC', email: 'coord_ac@nec.edu.in', passwordHash: hash, role: 'AC', isActive: true },
      { name: 'Coord Faculty', email: 'coord_fac@nec.edu.in', passwordHash: hash, role: 'FACULTY', facultyId: 'FWL-04', isActive: true },
      { name: 'Coord Admin', email: 'coord_admin@nec.edu.in', passwordHash: hash, role: 'ADMIN', isActive: true },
    ];

    for (const u of testUsers) {
      await User.findOneAndUpdate({ email: u.email }, { $set: u }, { upsert: true });
    }

    const hodUser = await User.findOne({ email: 'coord_hod@nec.edu.in' });
    const acUser = await User.findOne({ email: 'coord_ac@nec.edu.in' });
    const facUser = await User.findOne({ email: 'coord_fac@nec.edu.in' });
    const adminUser = await User.findOne({ email: 'coord_admin@nec.edu.in' });

    const hodToken = generateToken(hodUser);
    const acToken = generateToken(acUser);
    const facToken = generateToken(facUser);
    const adminToken = generateToken(adminUser);

    // ------------------------------------------------------------
    // TEST 1: GET academic contexts -> all 12 target cohorts available
    // ------------------------------------------------------------
    console.log('--- TEST 1: Academic Contexts Count & Target Cohorts ---');
    const ctxRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/academic-contexts?academicYear=2026-27&semester=Odd%20Semester&department=CSE&status=ACTIVE',
    });
    assert(ctxRes.statusCode === 200, 'GET /api/academic-contexts returns HTTP 200');
    const contexts = ctxRes.body.data || [];
    assert(contexts.length === 12, `Exactly 12 target active CSE contexts found (got: ${contexts.length})`);

    const iiSections = contexts.filter((c) => c.year === 'II Year').map((c) => c.section).sort();
    const iiiSections = contexts.filter((c) => c.year === 'III Year').map((c) => c.section).sort();
    const ivSections = contexts.filter((c) => c.year === 'IV Year').map((c) => c.section).sort();

    assert(JSON.stringify(iiSections) === JSON.stringify(['A', 'B', 'C', 'D']), 'II Year has sections A, B, C, D');
    assert(JSON.stringify(iiiSections) === JSON.stringify(['A', 'B', 'C', 'D']), 'III Year has sections A, B, C, D');
    assert(JSON.stringify(ivSections) === JSON.stringify(['A', 'B', 'C', 'D']), 'IV Year has sections A, B, C, D');

    const ctxII_A = contexts.find((c) => c.year === 'II Year' && c.section === 'A');
    const ctxIII_A = contexts.find((c) => c.year === 'III Year' && c.section === 'A');
    const ctxIV_A = contexts.find((c) => c.year === 'IV Year' && c.section === 'A');

    // ------------------------------------------------------------
    // TEST 2: II Year context -> Semester III course filtering works
    // ------------------------------------------------------------
    console.log('\n--- TEST 2: II Year Context Course Filtering (Semester III) ---');
    const sem3CoursesRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/courses?academicContextId=${ctxII_A._id}`,
    });
    assert(sem3CoursesRes.statusCode === 200, 'GET /api/courses?academicContextId=... returns HTTP 200');
    const sem3Courses = sem3CoursesRes.body.data.items || [];
    assert(sem3Courses.length === 10, `Semester III returns exactly 10 courses (got: ${sem3Courses.length})`);
    const allSem3 = sem3Courses.every((c) => c.semester === 'Semester III');
    assert(allSem3, 'All returned courses belong strictly to Semester III');

    // ------------------------------------------------------------
    // TEST 3: III Year context -> Semester V course filtering works
    // ------------------------------------------------------------
    console.log('\n--- TEST 3: III Year Context Course Filtering (Semester V) ---');
    const sem5CoursesRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/courses?academicContextId=${ctxIII_A._id}`,
    });
    assert(sem5CoursesRes.statusCode === 200, 'GET /api/courses for III Year returns HTTP 200');
    const sem5Courses = sem5CoursesRes.body.data.items || [];
    assert(sem5Courses.length === 6, `Semester V core courses count is 6 (got: ${sem5Courses.length})`);
    const allSem5 = sem5Courses.every((c) => c.semester === 'Semester V');
    assert(allSem5, 'All returned courses belong strictly to Semester V');

    // ------------------------------------------------------------
    // TEST 4: IV Year context -> Semester VII course filtering works
    // ------------------------------------------------------------
    console.log('\n--- TEST 4: IV Year Context Course Filtering (Semester VII) ---');
    const sem7CoursesRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/courses?academicContextId=${ctxIV_A._id}`,
    });
    assert(sem7CoursesRes.statusCode === 200, 'GET /api/courses for IV Year returns HTTP 200');
    const sem7Courses = sem7CoursesRes.body.data.items || [];
    assert(sem7Courses.length === 2, `Semester VII core courses count is 2 (got: ${sem7Courses.length})`);
    const allSem7 = sem7Courses.every((c) => c.semester === 'Semester VII');
    assert(allSem7, 'All returned courses belong strictly to Semester VII');

    // ------------------------------------------------------------
    // TEST 5: Existing HOD Course → Faculty allocation resolves correctly
    // ------------------------------------------------------------
    console.log('\n--- TEST 5: Existing HOD Allocation Resolution ---');
    const hodAllocRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod-allocations?academicContextId=${ctxIII_A._id}&courseCode=22CSC14`,
    });
    assert(hodAllocRes.statusCode === 200, 'GET /api/hod-allocations returns HTTP 200');
    const allocs = hodAllocRes.body.data || [];
    assert(allocs.length === 1, 'Found exactly 1 authoritative allocation for 22CSC14');
    assert(allocs[0].facultyId === 'FWL-04', 'Authoritative facultyId is FWL-04');
    assert(allocs[0].status === 'APPROVED', 'Authoritative allocation status is APPROVED');

    // Setup clean timetable version for testing session scheduling
    await TimetableSession.deleteMany({ academicContextId: ctxIII_A._id, day: 'SAT' });
    let testVersion = await TimetableVersion.findOne({
      department: 'CSE',
      year: 'III Year',
      section: 'A',
    });
    if (!testVersion) {
      testVersion = await TimetableVersion.create({
        academicYear: '2026-27',
        semester: 'Odd Semester',
        department: 'CSE',
        year: 'III Year',
        section: 'A',
        version: 2,
        versionLabel: 'v2.0 Test Suite',
        status: 'GENERATED',
      });
    }

    // ------------------------------------------------------------
    // TEST 6: No HOD allocation -> scheduling rejected
    // ------------------------------------------------------------
    console.log('\n--- TEST 6: Course Without HOD Allocation Rejected ---');
    // 22CSX01 has no HOD allocation in III Year A
    const noAllocRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSX01',
        facultyId: 'FWL-01',
        day: 'SAT',
        period: 'P1',
        room: 'LH-101',
      },
    });
    assert(noAllocRes.statusCode === 409, 'Scheduling without HOD allocation rejected with HTTP 409');
    assert(noAllocRes.body.code === 'HOD_ALLOCATION_REQUIRED', 'Error code is HOD_ALLOCATION_REQUIRED');

    // ------------------------------------------------------------
    // TEST 7: Multiple HOD allocations -> conflict rejected
    // ------------------------------------------------------------
    console.log('\n--- TEST 7: Conflicting Multiple HOD Allocations Rejected ---');
    // Temporarily insert a conflicting second allocation for 22CSC16 in III Year A
    const duplicateAlloc = await HODFacultyAllocation.create({
      academicContextId: ctxIII_A._id,
      courseCode: '22CSC16',
      courseName: 'Object Oriented Software Engineering',
      facultyId: 'FWL-10',
      facultyName: 'Dr. Conflicting Faculty',
      allocationType: 'THEORY',
      status: 'APPROVED',
      assignedBy: 'HOD',
    });

    const multiAllocRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC16',
        facultyId: 'FWL-03',
        day: 'SAT',
        period: 'P1',
        room: 'LH-101',
      },
    });
    assert(multiAllocRes.statusCode === 409, 'Scheduling with multiple conflicting allocations rejected with HTTP 409');
    assert(multiAllocRes.body.code === 'HOD_ALLOCATION_CONFLICT', 'Error code is HOD_ALLOCATION_CONFLICT');

    // Clean up duplicate allocation
    await HODFacultyAllocation.findByIdAndDelete(duplicateAlloc._id);

    // ------------------------------------------------------------
    // TEST 8: Coordinator submits correct HOD-assigned faculty -> accepted
    // ------------------------------------------------------------
    console.log('\n--- TEST 8: Valid Session Creation with HOD-Assigned Faculty ---');
    const validSessionRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC14',
        facultyId: 'FWL-04',
        day: 'SAT',
        period: 'P1',
        room: 'LH-101',
        sessionType: 'THEORY',
      },
    });
    assert(validSessionRes.statusCode === 201, 'Valid session scheduled with HTTP 201');
    assert(validSessionRes.body.data.facultyId === 'FWL-04', 'Scheduled session contains authoritative faculty FWL-04');
    const createdSessionId = validSessionRes.body.data._id;

    // ------------------------------------------------------------
    // TEST 9: Coordinator submits different faculty -> rejected
    // ------------------------------------------------------------
    console.log('\n--- TEST 9: Unauthorized Faculty Replacement Rejected ---');
    const wrongFacultyRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC14',
        facultyId: 'FWL-09', // Mismatched non-HOD faculty
        day: 'SAT',
        period: 'P2',
        room: 'LH-101',
      },
    });
    assert(wrongFacultyRes.statusCode === 409, 'Non-HOD faculty submission rejected with HTTP 409');
    assert(wrongFacultyRes.body.code === 'HOD_FACULTY_MISMATCH', 'Error code is HOD_FACULTY_MISMATCH');

    // ------------------------------------------------------------
    // TEST 10: Class conflict -> rejected
    // ------------------------------------------------------------
    console.log('\n--- TEST 10: Class Cohort Slot Conflict Rejected ---');
    // SAT P1 is already occupied by 22CSC14 for III-A
    const classConflictRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC16', // different course, same class, same slot
        facultyId: 'FWL-03',
        day: 'SAT',
        period: 'P1',
        room: 'LH-102',
      },
    });
    assert(classConflictRes.statusCode === 409, 'Class slot conflict rejected with HTTP 409');
    assert(classConflictRes.body.code === 'CLASS_TIME_CONFLICT', 'Error code is CLASS_TIME_CONFLICT');

    // ------------------------------------------------------------
    // TEST 11: Faculty conflict -> rejected
    // ------------------------------------------------------------
    console.log('\n--- TEST 11: Faculty Slot Conflict Across Cohorts Rejected ---');
    // FWL-04 is teaching SAT P1 in III-A. Attempt to schedule FWL-04 in II-A on SAT P1
    // First, temporarily ensure exactly 1 allocation for 22CSC05 in II-A to FWL-04 to test slot conflict
    const existingIIAllocs = await HODFacultyAllocation.find({ academicContextId: ctxII_A._id, courseCode: '22CSC05' }).lean();
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxII_A._id, courseCode: '22CSC05' });

    const iiAlloc = await HODFacultyAllocation.create({
      academicContextId: ctxII_A._id,
      courseCode: '22CSC05',
      courseName: 'Algorithms',
      facultyId: 'FWL-04',
      allocationType: 'THEORY',
      status: 'APPROVED',
      assignedBy: 'HOD',
    });

    const facConflictRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxII_A._id,
        courseCode: '22CSC05',
        facultyId: 'FWL-04',
        day: 'SAT',
        period: 'P1', // FWL-04 is already occupied here!
        room: 'LH-201',
      },
    });
    assert(facConflictRes.statusCode === 409, 'Faculty slot conflict rejected with HTTP 409');
    assert(facConflictRes.body.code === 'FACULTY_TIME_CONFLICT', 'Error code is FACULTY_TIME_CONFLICT');

    await HODFacultyAllocation.findByIdAndDelete(iiAlloc._id);
    if (existingIIAllocs.length > 0) {
      for (const oldA of existingIIAllocs) {
        delete oldA._id;
        await HODFacultyAllocation.create(oldA);
      }
    }

    // ------------------------------------------------------------
    // TEST 12: Exact duplicate session -> rejected
    // ------------------------------------------------------------
    console.log('\n--- TEST 12: Exact Duplicate Session Rejected ---');
    const exactDupeRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC14',
        facultyId: 'FWL-04',
        day: 'SAT',
        period: 'P1',
        room: 'LH-101',
      },
    });
    assert(exactDupeRes.statusCode === 409, 'Exact duplicate session rejected with HTTP 409');
    assert(exactDupeRes.body.code === 'DUPLICATE_SESSION', 'Error code is DUPLICATE_SESSION');

    // ------------------------------------------------------------
    // TEST 13: Same course on a different period -> allowed
    // ------------------------------------------------------------
    console.log('\n--- TEST 13: Legitimate Repeated Course Session Allowed ---');
    const repeatCourseRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC14',
        facultyId: 'FWL-04',
        day: 'SAT',
        period: 'P3', // Different period!
        room: 'LH-101',
      },
    });
    assert(repeatCourseRes.statusCode === 201, 'Same course on different period successfully scheduled (HTTP 201)');
    const repeatSessionId = repeatCourseRes.body.data._id;

    // ------------------------------------------------------------
    // TEST 14: Same faculty on a different period -> allowed
    // ------------------------------------------------------------
    console.log('\n--- TEST 14: Same Faculty on Different Period Allowed ---');
    const repeatFacultyRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC14',
        facultyId: 'FWL-04',
        day: 'SAT',
        period: 'P5', // Another different period!
        room: 'LH-101',
      },
    });
    assert(repeatFacultyRes.statusCode === 201, 'Same faculty on different period successfully scheduled (HTTP 201)');
    const facRepeatSessionId = repeatFacultyRes.body.data._id;

    // ------------------------------------------------------------
    // TEST 15: AC can submit: GENERATED → PENDING_HOD_APPROVAL
    // ------------------------------------------------------------
    console.log('\n--- TEST 15: AC Submission to PENDING_HOD_APPROVAL ---');
    await TimetableVersion.findByIdAndUpdate(testVersion._id, { status: 'GENERATED' });
    const acSubmitRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersion._id}/status`,
      headers: { Authorization: `Bearer ${acToken}` },
      body: { status: 'PENDING_HOD_APPROVAL' },
    });
    assert(acSubmitRes.statusCode === 200, 'AC can submit GENERATED -> PENDING_HOD_APPROVAL (HTTP 200)');
    assert(acSubmitRes.body.data.status === 'PENDING_HOD_APPROVAL', 'Version status updated to PENDING_HOD_APPROVAL');

    // ------------------------------------------------------------
    // TEST 16: AC cannot: PENDING_HOD_APPROVAL → APPROVED
    // ------------------------------------------------------------
    console.log('\n--- TEST 16: AC Cannot Approve Own Timetable ---');
    const acApproveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersion._id}/status`,
      headers: { Authorization: `Bearer ${acToken}` },
      body: { status: 'APPROVED' },
    });
    assert(acApproveRes.statusCode === 403, 'AC approval attempt rejected with HTTP 403');
    assert(acApproveRes.body.code === 'STATE_TRANSITION_ERROR', 'Error code is STATE_TRANSITION_ERROR');

    // ------------------------------------------------------------
    // TEST 17: HOD can approve
    // ------------------------------------------------------------
    console.log('\n--- TEST 17: HOD Approval Authority ---');
    const hodApproveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersion._id}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'APPROVED' },
    });
    assert(hodApproveRes.statusCode === 200, 'HOD can transition PENDING_HOD_APPROVAL -> APPROVED (HTTP 200)');
    assert(hodApproveRes.body.data.status === 'APPROVED', 'Version status successfully transitioned to APPROVED');

    // ------------------------------------------------------------
    // TEST 18: Coordinator substitute assignment is authorized
    // ------------------------------------------------------------
    console.log('\n--- TEST 18: Coordinator Substitute Assignment RBAC ---');
    const testAbsence = await FacultyAbsence.create({
      facultyId: 'FWL-04',
      date: '2026-10-20',
      reason: 'Special Duty',
      status: 'APPROVED',
    });

    const acSubstituteRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/substitutes',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        absenceId: testAbsence._id,
        originalFacultyId: 'FWL-04',
        substituteFacultyId: 'FWL-07',
        timetableSessionId: createdSessionId,
        date: '2026-10-20',
        period: 'P1',
      },
    });
    assert(acSubstituteRes.statusCode === 201, 'Coordinator is authorized to assign substitute (HTTP 201)');
    assert(acSubstituteRes.body.data.status === 'PENDING', 'Substitute allocation status is PENDING');

    // Clean up substitute & absence
    await SubstituteAllocation.findByIdAndDelete(acSubstituteRes.body.data._id);
    await FacultyAbsence.findByIdAndDelete(testAbsence._id);

    // ------------------------------------------------------------
    // TEST 19: HOD can perform required faculty management operations
    // ------------------------------------------------------------
    console.log('\n--- TEST 19: HOD Faculty Management (Create & Delete) ---');
    const testFacId = 'FWL-99';
    await Faculty.deleteOne({ facultyId: testFacId });
    const createdFac = await Faculty.create({
      facultyId: testFacId,
      facultyName: 'Dr. Test Transient Faculty',
      designation: 'Assistant Professor',
      department: 'CSE',
      roles: ['FACULTY'],
    });
    assert(!!createdFac._id, 'Transient faculty created for delete test');

    const hodDeleteRes = await makeRequest(app, {
      method: 'DELETE',
      path: `/api/faculty/${testFacId}`,
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(hodDeleteRes.statusCode === 200, 'HOD successfully deleted faculty (HTTP 200)');
    const checkFac = await Faculty.findOne({ facultyId: testFacId });
    assert(!checkFac, 'Faculty record cleanly removed from database');

    // ------------------------------------------------------------
    // TEST 20: Invalid authentication → 401
    // ------------------------------------------------------------
    console.log('\n--- TEST 20: Unauthenticated Requests Rejected (HTTP 401) ---');
    const unauthRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      body: { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'SAT', period: 'P1' },
    });
    assert(unauthRes.statusCode === 401, 'Request without token rejected with HTTP 401');
    assert(unauthRes.body.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');

    // ------------------------------------------------------------
    // TEST 21: Unauthorized role → 403
    // ------------------------------------------------------------
    console.log('\n--- TEST 21: Unauthorized Role Actions Rejected (HTTP 403) ---');
    const facScheduleRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: { Authorization: `Bearer ${facToken}` }, // FACULTY role cannot schedule sessions
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC14',
        facultyId: 'FWL-04',
        day: 'SAT',
        period: 'P6',
      },
    });
    assert(facScheduleRes.statusCode === 403, 'FACULTY role rejected from scheduling session (HTTP 403)');
    assert(facScheduleRes.body.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // ------------------------------------------------------------
    // TEST 22: R22 course/context integrity remains intact
    // ------------------------------------------------------------
    console.log('\n--- TEST 22: R22 Course & Context Integrity ---');
    const totalCourses = await Course.countDocuments({ isActive: true });
    assert(totalCourses === 119, `Total active courses count remains exactly 119 (got: ${totalCourses})`);

    const r22UgCourses = await Course.countDocuments({ isR22UG: true, regulation: 'R22' });
    assert(r22UgCourses === 109, `R22 UG courses count remains exactly 109 (got: ${r22UgCourses})`);

    const totalActiveContexts = await AcademicContext.countDocuments({ status: 'ACTIVE' });
    assert(totalActiveContexts === 12, `Total active academic contexts remains exactly 12 (got: ${totalActiveContexts})`);

    // Clean up test sessions
    await TimetableSession.findByIdAndDelete(createdSessionId);
    await TimetableSession.findByIdAndDelete(repeatSessionId);
    await TimetableSession.findByIdAndDelete(facRepeatSessionId);
    await User.deleteMany({ email: { $in: testUsers.map((u) => u.email) } });

    console.log('\n============================================================');
    console.log(`COORDINATOR TIMETABLE TEST SUITE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[Coordinator Timetable Suite Error]:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runCoordinatorTimetableFlowTests();
}

module.exports = { runCoordinatorTimetableFlowTests };
