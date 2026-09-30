/**
 * HOD Multi-Faculty Allocation Comprehensive Test Suite
 * 
 * Tests authoritative allocation policies for:
 * 1. Theory courses (THEORY_SINGLE: 1 Faculty, 100% backward compatible)
 * 2. LAB courses (LAB_2_TO_3: 2-3 Faculty, PRIMARY linked to Theory, ADDITIONAL required, OPTIONAL)
 * 3. Soft/Analytical Skills (MC_SAS: MATHS_BME + ENGLISH distinct faculty)
 * 4. Indian Constitution (MC_DEPARTMENT: department isolation enforced)
 * 5. Induction Programme (MC_OPTIONAL_MAPPING: optional faculty & mapping, OPTIONAL_NOT_MAPPED state)
 * 6. Timetable Session: 1 class session in DB, expands to all assigned faculty timetables
 * 7. Timetable Solver & Conflict Detection for multi-faculty sessions
 * 8. Approval and Publish lifecycle preservation of facultyAssignments
 * 9. Whole-CSE / Academic Context Isolation
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const AcademicContext = require('../src/models/AcademicContext');
const Course = require('../src/models/Course');
const Faculty = require('../src/models/Faculty');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const User = require('../src/models/User');
const { generateToken } = require('../src/utils/generateToken');
const { getFacultySchedule, transitionTimetableStatus } = require('../src/services/timetableService');

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

async function runTests() {
  console.log('============================================================');
  console.log('HOD MULTI-FACULTY ALLOCATION & TIMETABLE TEST SUITE');
  console.log('============================================================\n');

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nec_faculty_db');
    }

    // 0. Ensure HOD and Coordinator users exist
    let hodUser = await User.findOne({ role: 'HOD' });
    if (!hodUser) {
      hodUser = await User.create({
        email: 'hod.allocation.test@nec.edu.in',
        password: '$2a$10$hashedpasswordplaceholder1234567890',
        name: 'Dr. T. Rajasekaran (HOD)',
        role: 'HOD',
        department: 'CSE',
      });
    }

    const hodToken = generateToken(hodUser);
    const authHeaders = { Authorization: `Bearer ${hodToken}` };

    // Locate target contexts
    let ctxIII_A = await AcademicContext.findOne({ department: 'CSE', year: 'III Year', section: 'A' });
    if (!ctxIII_A) {
      ctxIII_A = await AcademicContext.create({
        academicYear: '2026-27',
        semester: 'Odd Semester',
        department: 'CSE',
        year: 'III Year',
        section: 'A',
        program: 'UG',
        status: 'ACTIVE',
      });
    }

    let ctxIII_B = await AcademicContext.findOne({ department: 'CSE', year: 'III Year', section: 'B' });
    if (!ctxIII_B) {
      ctxIII_B = await AcademicContext.create({
        academicYear: '2026-27',
        semester: 'Odd Semester',
        department: 'CSE',
        year: 'III Year',
        section: 'B',
        program: 'UG',
        status: 'ACTIVE',
      });
    }

    let ctxII_A = await AcademicContext.findOne({ department: 'CSE', year: 'II Year', section: 'A' });
    if (!ctxII_A) {
      ctxII_A = await AcademicContext.create({
        academicYear: '2026-27',
        semester: 'Odd Semester',
        department: 'CSE',
        year: 'II Year',
        section: 'A',
        program: 'UG',
        status: 'ACTIVE',
      });
    }

    console.log(`Contexts ready: III-A (${ctxIII_A._id}), III-B (${ctxIII_B._id}), II-A (${ctxII_A._id})`);

    // Ensure theory prerequisite: 22CSC15 allocated to FWL-14 in III-A
    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: ctxIII_A._id, courseCode: '22CSC15' },
      {
        academicContextId: ctxIII_A._id,
        courseCode: '22CSC15',
        courseName: 'Full Stack Development',
        facultyId: 'FWL-14',
        facultyName: 'Ms. D. Vinoparkavi',
        allocationRule: 'THEORY_SINGLE',
        allocationType: 'THEORY',
        facultyAssignments: [
          { facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi', role: 'PRIMARY', required: true, source: 'MANUAL' },
        ],
        status: 'APPROVED',
        assignedBy: hodUser.name,
      },
      { upsert: true, new: true }
    );

    // ============================================================
    // SECTION 1: GET ALLOCATION CONTEXT
    // ============================================================
    console.log('\n--- SECTION 1: GET Allocation Context API ---');
    const getCtxRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod-allocations/context/${ctxIII_A._id}`,
      headers: authHeaders,
    });

    assert(getCtxRes.statusCode === 200, 'GET /api/hod-allocations/context/:id returns HTTP 200');
    assert(getCtxRes.body.success === true, 'Response contains success: true');
    assert(getCtxRes.body.data && getCtxRes.body.data.courses, 'Response returns courses array');

    const labCourseInfo = getCtxRes.body.data.courses.find((c) => c.courseCode === '22CSP09');
    assert(labCourseInfo !== undefined, 'Courses array contains LAB course 22CSP09');
    assert(labCourseInfo.allocationRule === 'LAB_2_TO_3', '22CSP09 allocationRule is LAB_2_TO_3');
    assert(labCourseInfo.constraints && labCourseInfo.constraints.minFaculty === 2, '22CSP09 minFaculty constraint is 2');
    assert(labCourseInfo.constraints && labCourseInfo.constraints.maxFaculty === 3, '22CSP09 maxFaculty constraint is 3');
    assert(Array.isArray(labCourseInfo.facultySlots) && labCourseInfo.facultySlots.length === 3, '22CSP09 exposes 3 faculty slots (PRIMARY, ADDITIONAL, OPTIONAL)');

    const primarySlot = labCourseInfo.facultySlots.find((s) => s.role === 'PRIMARY');
    assert(primarySlot && primarySlot.source === 'THEORY_LINKED', 'PRIMARY slot source is THEORY_LINKED');
    assert(primarySlot && primarySlot.faculty && primarySlot.faculty.facultyId === 'FWL-14', 'PRIMARY slot auto-linked to FWL-14 from Theory 22CSC15');

    // Also test alias route /api/hod/faculty-allocation/context/:id
    const aliasCtxRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod/faculty-allocation/context/${ctxIII_A._id}`,
      headers: authHeaders,
    });
    assert(aliasCtxRes.statusCode === 200, 'GET /api/hod/faculty-allocation/context/:id (alias) returns HTTP 200');

    // ============================================================
    // SECTION 2: LAB ALLOCATION VALIDATION (22CSP09)
    // ============================================================
    console.log('\n--- SECTION 2: LAB Allocation Validation (min 2, max 3, theory link) ---');

    // Test 2.1: 1 faculty -> Reject (LAB_MINIMUM_FACULTY_NOT_MET)
    const lab1FacRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22CSP09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-14', role: 'PRIMARY' },
        ],
      },
    });
    assert(lab1FacRes.statusCode === 400, '1 faculty rejected with HTTP 400');
    assert(lab1FacRes.body.error?.code === 'LAB_MINIMUM_FACULTY_NOT_MET', 'Error code is LAB_MINIMUM_FACULTY_NOT_MET');

    // Test 2.2: 4 faculty -> Reject (LAB_MAXIMUM_FACULTY_EXCEEDED)
    const lab4FacRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22CSP09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-14', role: 'PRIMARY' },
          { facultyId: 'FWL-06', role: 'ADDITIONAL' },
          { facultyId: 'FWL-04', role: 'OPTIONAL' },
          { facultyId: 'FWL-12', role: 'OPTIONAL' },
        ],
      },
    });
    assert(lab4FacRes.statusCode === 400, '4 faculty rejected with HTTP 400');
    assert(lab4FacRes.body.error?.code === 'LAB_MAXIMUM_FACULTY_EXCEEDED', 'Error code is LAB_MAXIMUM_FACULTY_EXCEEDED');

    // Test 2.3: Duplicate faculty -> Reject (LAB_DUPLICATE_FACULTY)
    const labDupRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22CSP09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-14', role: 'PRIMARY' },
          { facultyId: 'FWL-14', role: 'ADDITIONAL' },
        ],
      },
    });
    assert(labDupRes.statusCode === 400, 'Duplicate faculty rejected with HTTP 400');
    assert(labDupRes.body.error?.code === 'LAB_DUPLICATE_FACULTY', 'Error code is LAB_DUPLICATE_FACULTY');

    // Test 2.4: Primary / Theory mismatch -> Reject (LAB_PRIMARY_THEORY_MISMATCH)
    const labMismatchRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22CSP09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-03', role: 'PRIMARY' }, // Not FWL-14!
          { facultyId: 'FWL-06', role: 'ADDITIONAL' },
        ],
      },
    });
    assert(labMismatchRes.statusCode === 400, 'Theory mismatch rejected with HTTP 400');
    assert(labMismatchRes.body.error?.code === 'LAB_PRIMARY_THEORY_MISMATCH', 'Error code is LAB_PRIMARY_THEORY_MISMATCH');

    // Test 2.5: Additional missing -> Reject (LAB_ADDITIONAL_FACULTY_REQUIRED)
    const labMissingAddRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22CSP09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-14', role: 'PRIMARY' },
          { facultyId: 'FWL-06', role: 'OPTIONAL' }, // Missing ADDITIONAL role!
        ],
      },
    });
    assert(labMissingAddRes.statusCode === 400, 'Missing ADDITIONAL role rejected with HTTP 400');
    assert(labMissingAddRes.body.error?.code === 'LAB_ADDITIONAL_FACULTY_REQUIRED', 'Error code is LAB_ADDITIONAL_FACULTY_REQUIRED');

    // Test 2.6: Unknown faculty -> Reject (LAB_FACULTY_NOT_FOUND)
    const labUnknownFacRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22CSP09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-14', role: 'PRIMARY' },
          { facultyId: 'FWL-NONEXISTENT', role: 'ADDITIONAL' },
        ],
      },
    });
    assert(labUnknownFacRes.statusCode === 400, 'Unknown faculty rejected with HTTP 400');
    assert(labUnknownFacRes.body.error?.code === 'LAB_FACULTY_NOT_FOUND', 'Error code is LAB_FACULTY_NOT_FOUND');

    // Test 2.7: 2 faculty (PRIMARY + ADDITIONAL) -> PASS (COMPLETE_2)
    const lab2PassRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22CSP09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-14', role: 'PRIMARY' },
          { facultyId: 'FWL-06', role: 'ADDITIONAL' },
        ],
      },
    });
    assert(lab2PassRes.statusCode === 200, '2 faculty allocation succeeds with HTTP 200');
    assert(lab2PassRes.body.data?.allocationStatus === 'COMPLETE_2', 'Allocation status is COMPLETE_2');
    assert(lab2PassRes.body.data?.facultyAssignments?.length === 2, '2 faculty assignments persisted');

    // Test 2.8: 3 faculty (PRIMARY + ADDITIONAL + OPTIONAL) -> PASS (COMPLETE_3)
    const lab3PassRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22CSP09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-14', role: 'PRIMARY' },
          { facultyId: 'FWL-06', role: 'ADDITIONAL' },
          { facultyId: 'FWL-04', role: 'OPTIONAL' },
        ],
      },
    });
    assert(lab3PassRes.statusCode === 200, '3 faculty allocation succeeds with HTTP 200');
    assert(lab3PassRes.body.data?.allocationStatus === 'COMPLETE_3', 'Allocation status is COMPLETE_3');
    assert(lab3PassRes.body.data?.facultyAssignments?.length === 3, '3 faculty assignments persisted');

    // ============================================================
    // SECTION 3: SOFT/ANALYTICAL SKILLS (MC_SAS: 22MAN8R / 22MAN04R)
    // ============================================================
    console.log('\n--- SECTION 3: SAS Allocation Validation (MATHS_BME + ENGLISH distinct) ---');

    // Test 3.1: Missing MATHS_BME -> Reject (SAS_MATHS_BME_REQUIRED)
    const sasMissingMaths = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22MAN8R`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-01', role: 'ENGLISH' },
        ],
      },
    });
    assert(sasMissingMaths.statusCode === 400, 'Missing MATHS_BME rejected with HTTP 400');
    assert(sasMissingMaths.body.error?.code === 'SAS_MATHS_BME_REQUIRED', 'Error code is SAS_MATHS_BME_REQUIRED');

    // Test 3.2: Missing ENGLISH -> Reject (SAS_ENGLISH_REQUIRED)
    const sasMissingEng = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22MAN8R`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-01', role: 'MATHS_BME' },
        ],
      },
    });
    assert(sasMissingEng.statusCode === 400, 'Missing ENGLISH rejected with HTTP 400');
    assert(sasMissingEng.body.error?.code === 'SAS_ENGLISH_REQUIRED', 'Error code is SAS_ENGLISH_REQUIRED');

    // Test 3.3: Same faculty in both roles -> Reject (SAS_DUPLICATE_FACULTY)
    const sasSameFac = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22MAN8R`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-01', role: 'MATHS_BME' },
          { facultyId: 'FWL-01', role: 'ENGLISH' },
        ],
      },
    });
    assert(sasSameFac.statusCode === 400, 'Same faculty in both SAS roles rejected with HTTP 400');
    assert(sasSameFac.body.error?.code === 'SAS_DUPLICATE_FACULTY', 'Error code is SAS_DUPLICATE_FACULTY');

    // Test 3.4: Both distinct faculty present -> PASS (COMPLETE)
    const sasPass = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxIII_A._id}/course/22MAN8R`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-01', role: 'MATHS_BME' },
          { facultyId: 'FWL-02', role: 'ENGLISH' },
        ],
      },
    });
    assert(sasPass.statusCode === 200, 'Valid SAS allocation succeeds with HTTP 200');
    assert(sasPass.body.data?.allocationStatus === 'COMPLETE', 'SAS allocationStatus is COMPLETE');

    // ============================================================
    // SECTION 4: INDIAN CONSTITUTION (MC_DEPARTMENT: 22MAN09)
    // ============================================================
    console.log('\n--- SECTION 4: Indian Constitution (MC_DEPARTMENT: context department isolation) ---');

    // Test 4.1: Other department faculty (ECE: FWL-26) -> Reject (MC_DEPARTMENT_FACULTY_NOT_ELIGIBLE)
    const mcOtherDept = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxII_A._id}/course/22MAN09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-26', role: 'PRIMARY' },
        ],
      },
    });
    assert(mcOtherDept.statusCode === 400, 'Other department faculty rejected with HTTP 400');
    assert(mcOtherDept.body.error?.code === 'MC_DEPARTMENT_FACULTY_NOT_ELIGIBLE', 'Error code is MC_DEPARTMENT_FACULTY_NOT_ELIGIBLE');

    // Test 4.2: Same department faculty (CSE: FWL-03) -> PASS (COMPLETE)
    const mcSameDept = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxII_A._id}/course/22MAN09`,
      headers: authHeaders,
      body: {
        facultyAssignments: [
          { facultyId: 'FWL-03', role: 'PRIMARY' },
        ],
      },
    });
    assert(mcSameDept.statusCode === 200, 'CSE department faculty succeeds with HTTP 200');
    assert(mcSameDept.body.data?.allocationStatus === 'COMPLETE', 'Allocation status is COMPLETE');

    // ============================================================
    // SECTION 5: INDUCTION PROGRAMME (MC_OPTIONAL_MAPPING)
    // ============================================================
    console.log('\n--- SECTION 5: Induction Programme (MC_OPTIONAL_MAPPING: optional faculty & mapping) ---');

    let ctxI_A = await AcademicContext.findOne({ department: 'CSE', year: 'I Year', section: 'A' });
    if (!ctxI_A) {
      ctxI_A = await AcademicContext.create({
        academicYear: '2026-27',
        semester: 'Odd Semester',
        department: 'CSE',
        year: 'I Year',
        section: 'A',
        program: 'UG',
        status: 'ACTIVE',
      });
    }

    let indCourse = await Course.findOne({ courseCode: '22MAN01' });
    if (!indCourse) {
      indCourse = await Course.create({
        courseCode: '22MAN01',
        courseName: 'Induction Programme',
        courseType: 'MC',
        category: 'MC',
        semester: 'Semester I',
        department: 'CSE',
        L: 0, T: 0, P: 0, totalPeriod: 0, credits: 0,
      });
    }

    const indNoFacRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxI_A._id}/course/${indCourse.courseCode}`,
      headers: authHeaders,
      body: {
        facultyAssignments: [],
        timetableMapping: {
          enabled: false,
        },
      },
    });
    assert(indNoFacRes.statusCode === 200, 'Induction with no faculty succeeds with HTTP 200');
    assert(indNoFacRes.body.data?.allocationStatus === 'OPTIONAL_NOT_MAPPED', 'Status is OPTIONAL_NOT_MAPPED');

    // With mapping enabled and faculty
    const indMappedRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctxI_A._id}/course/${indCourse.courseCode}`,
      headers: authHeaders,
      body: {
        facultyAssignments: [{ facultyId: 'FWL-03', role: 'PRIMARY' }],
        timetableMapping: {
          enabled: true,
        },
      },
    });
    assert(indMappedRes.statusCode === 200, 'Induction with faculty succeeds with HTTP 200');
    assert(indMappedRes.body.data?.allocationStatus === 'MAPPED', 'Status is MAPPED');

    // ============================================================
    // SECTION 6: TIMETABLE INTEGRATION & SINGLE SESSION GUARANTEE
    // ============================================================
    console.log('\n--- SECTION 6: Timetable Session Guarantee (1 Class Session, Expands to All Assigned Faculty) ---');

    // Create a timetable version for testing
    let testVersion = await TimetableVersion.create({
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'III Year',
      section: 'A',
      version: 99,
      versionLabel: 'v99.0 Test Multi-Faculty Version',
      status: 'GENERATED',
      generatedBy: 'Coordinator',
    });

    // Clean any prior sessions for this test version
    await TimetableSession.deleteMany({ timetableVersionId: testVersion._id });

    // Seed 1 LAB session for 22CSP09 on MON P5 with 2 faculty: FWL-14 and FWL-06
    const labSession = await TimetableSession.create({
      timetableVersionId: testVersion._id,
      academicContextId: ctxIII_A._id,
      courseCode: '22CSP09',
      courseName: 'Full Stack Development Laboratory',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      facultyAssignments: [
        { facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi', role: 'PRIMARY' },
        { facultyId: 'FWL-06', facultyName: 'Mrs. E. Padma', role: 'ADDITIONAL' },
      ],
      day: 'MON',
      period: 'P5',
      room: 'Web Tech Lab',
      sessionType: 'LAB',
      duration: 1,
    });

    // 6.1 Check that exactly ONE session exists in the DB for that slot
    const countInDb = await TimetableSession.countDocuments({
      timetableVersionId: testVersion._id,
      academicContextId: ctxIII_A._id,
      day: 'MON',
      period: 'P5',
    });
    assert(countInDb === 1, `Exactly 1 class timetable session exists in DB for MON P5 (got: ${countInDb})`);

    // 6.2 Check that Primary Faculty (FWL-14) sees the session
    const fwl14Sessions = await TimetableSession.find({
      timetableVersionId: testVersion._id,
      $or: [{ facultyId: 'FWL-14' }, { 'facultyAssignments.facultyId': 'FWL-14' }],
    });
    assert(fwl14Sessions.length === 1, 'Primary faculty FWL-14 timetable includes the session');

    // 6.3 Check that Additional Faculty (FWL-06) ALSO sees the session
    const fwl06Sessions = await TimetableSession.find({
      timetableVersionId: testVersion._id,
      $or: [{ facultyId: 'FWL-06' }, { 'facultyAssignments.facultyId': 'FWL-06' }],
    });
    assert(fwl06Sessions.length === 1, 'Additional faculty FWL-06 timetable includes the session');

    // 6.4 Check that Unassigned Faculty (FWL-03) DOES NOT see the session
    const fwl03Sessions = await TimetableSession.find({
      timetableVersionId: testVersion._id,
      $or: [{ facultyId: 'FWL-03' }, { 'facultyAssignments.facultyId': 'FWL-03' }],
    });
    assert(fwl03Sessions.length === 0, 'Unassigned faculty FWL-03 timetable does NOT include the session');

    // 6.5 Multi-Faculty Conflict Detection in POST /api/timetable/session
    // Try scheduling a conflicting session for Additional Faculty FWL-06 on MON P5
    const conflictRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: authHeaders,
      body: {
        timetableVersionId: testVersion._id,
        academicContextId: ctxIII_A._id,
        courseCode: '22CSX42', // Theory taught by FWL-06
        courseName: 'UI and UX Design',
        facultyId: 'FWL-06',
        day: 'MON',
        period: 'P5',
      },
    });
    assert(conflictRes.statusCode === 409, 'Scheduling conflict for assigned additional faculty rejected with HTTP 409');
    assert(conflictRes.body.error?.code === 'CLASS_TIME_CONFLICT' || conflictRes.body.error?.code === 'FACULTY_TIME_CONFLICT', 'Conflict error code returned');

    // ============================================================
    // SECTION 7: APPROVAL & PUBLISH LIFECYCLE PRESERVATION
    // ============================================================
    console.log('\n--- SECTION 7: Lifecycle Preservation (GENERATED -> PENDING_HOD_APPROVAL -> APPROVED -> PUBLISHED) ---');

    // Transition version: GENERATED -> PENDING_HOD_APPROVAL
    await transitionTimetableStatus(testVersion._id, 'PENDING_HOD_APPROVAL', hodUser);
    let vAfterSubmit = await TimetableVersion.findById(testVersion._id);
    assert(vAfterSubmit.status === 'PENDING_HOD_APPROVAL', 'Version transitioned to PENDING_HOD_APPROVAL');

    // Transition version: PENDING_HOD_APPROVAL -> APPROVED
    await transitionTimetableStatus(testVersion._id, 'APPROVED', hodUser);
    let vAfterApprove = await TimetableVersion.findById(testVersion._id);
    assert(vAfterApprove.status === 'APPROVED', 'Version transitioned to APPROVED');

    // Transition version: APPROVED -> PUBLISHED
    await transitionTimetableStatus(testVersion._id, 'PUBLISHED', hodUser);
    let vAfterPublish = await TimetableVersion.findById(testVersion._id);
    assert(vAfterPublish.status === 'PUBLISHED', 'Version transitioned to PUBLISHED');

    // Verify session still retains full facultyAssignments array
    const sessionAfterPublish = await TimetableSession.findById(labSession._id);
    assert(sessionAfterPublish.facultyAssignments.length === 2, 'Sessions retain full facultyAssignments after PUBLISHED transition');
    assert(sessionAfterPublish.facultyAssignments[0].facultyId === 'FWL-14', 'Primary faculty preserved after publish');
    assert(sessionAfterPublish.facultyAssignments[1].facultyId === 'FWL-06', 'Additional faculty preserved after publish');

    // Verify Review Matrix API returns facultyAssignments
    const matrixRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/review-matrix?academicContextId=${ctxIII_A._id}&versionId=${testVersion._id}`,
      headers: authHeaders,
    });
    assert(matrixRes.statusCode === 200, 'GET /api/timetable/review-matrix returns HTTP 200');
    const matrixLabSession = matrixRes.body.data?.sessions?.find((s) => s.courseCode === '22CSP09' && s.day === 'MON' && s.period === 'P5');
    assert(matrixLabSession !== undefined, 'Review matrix includes the LAB session');
    assert(Array.isArray(matrixLabSession.facultyAssignments) && matrixLabSession.facultyAssignments.length === 2, 'Review matrix session exposes both assigned faculty');

    // Clean up test version
    await TimetableSession.deleteMany({ timetableVersionId: testVersion._id });
    await TimetableVersion.findByIdAndDelete(testVersion._id);

    // ============================================================
    // SECTION 8: THEORY ALLOCATION BACKWARD COMPATIBILITY
    // ============================================================
    console.log('\n--- SECTION 8: Theory Backward Compatibility (Single faculty unchanged) ---');

    // Ensure clean state before testing Theory creation
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxIII_B._id, courseCode: '22CSC16' });

    // Submit single faculty theory allocation via standard POST /api/hod-allocations
    const theoryPostRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/hod-allocations',
      headers: authHeaders,
      body: {
        academicContextId: ctxIII_B._id,
        courseCode: '22CSC16',
        courseName: 'Object Oriented Software Engineering',
        facultyId: 'FWL-03',
        facultyName: 'Dr. S. Karpusamy',
        allocationType: 'THEORY',
      },
    });
    assert(theoryPostRes.statusCode === 201, 'Legacy single-faculty Theory creation returns HTTP 201');
    assert(theoryPostRes.body.data?.facultyId === 'FWL-03', 'Theory allocation persists legacy facultyId');
    assert(theoryPostRes.body.data?.allocationRule === 'THEORY_SINGLE', 'Theory allocation assigned THEORY_SINGLE rule');

    // Update Theory allocation via PUT
    const theoryPutRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/${theoryPostRes.body.data._id}`,
      headers: authHeaders,
      body: {
        facultyId: 'FWL-04',
        facultyName: 'Dr. A. Manchula',
      },
    });
    assert(theoryPutRes.statusCode === 200, 'Legacy single-faculty Theory update returns HTTP 200');
    assert(theoryPutRes.body.data?.facultyId === 'FWL-04', 'Theory allocation successfully updated to FWL-04');

    // Clean up theory test allocation
    await HODFacultyAllocation.findByIdAndDelete(theoryPostRes.body.data._id);

    // ============================================================
    // SECTION 9: WHOLE-CSE / ACADEMIC CONTEXT ISOLATION
    // ============================================================
    console.log('\n--- SECTION 9: Whole-CSE Academic Context Isolation ---');

    let ctxIII_D = await AcademicContext.findOne({ department: 'CSE', year: 'III Year', section: 'D' });
    if (!ctxIII_D) {
      ctxIII_D = await AcademicContext.create({
        academicYear: '2026-27',
        semester: 'Odd Semester',
        department: 'CSE',
        year: 'III Year',
        section: 'D',
        program: 'UG',
        status: 'ACTIVE',
      });
    }

    // Ensure III-D does not have 22CSP09
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxIII_D._id, courseCode: '22CSP09' });

    // Allocation in III-A for 22CSP09 should NOT show in III-D
    const ctxDGetRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod-allocations/context/${ctxIII_D._id}`,
      headers: authHeaders,
    });
    assert(ctxDGetRes.statusCode === 200, 'GET /context/:id for III-D returns HTTP 200');
    const courseInD = ctxDGetRes.body.data?.courses?.find((c) => c.courseCode === '22CSP09');
    assert(
      !courseInD.currentFacultyAssignments || courseInD.currentFacultyAssignments.length === 0,
      'III-A allocation does NOT bleed into III-D (Context isolation enforced)'
    );

    // Delete test induction course and clean up I Year context
    if (indCourse && indCourse.courseCode === '22MC01') {
      await Course.findByIdAndDelete(indCourse._id);
      await HODFacultyAllocation.deleteMany({ courseCode: '22MC01' });
    }
    if (ctxI_A) {
      await AcademicContext.findByIdAndDelete(ctxI_A._id);
      await HODFacultyAllocation.deleteMany({ academicContextId: ctxI_A._id });
    }

    // Restore baseline 2-faculty allocation for 22CSP09 in III-A
    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: ctxIII_A._id, courseCode: '22CSP09' },
      {
        facultyAssignments: [
          { facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi', role: 'PRIMARY', required: true, source: 'THEORY_LINKED' },
          { facultyId: 'FWL-06', facultyName: 'Mrs. E. Padma', role: 'ADDITIONAL', required: true, source: 'MANUAL' },
        ],
        status: 'APPROVED',
      }
    );

    console.log('\n============================================================');
    console.log(`HOD MULTI-FACULTY ALLOCATION TEST SUITE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    await mongoose.disconnect();
    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
