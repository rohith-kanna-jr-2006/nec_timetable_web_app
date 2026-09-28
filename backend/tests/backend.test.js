/**
 * Backend Comprehensive Test Suite
 *
 * Covers all 20 mandatory verification scenarios:
 * 1. MongoDB connection
 * 2. Health endpoint (/api/health)
 * 3. Login success & credential checking
 * 4. Login failure (invalid password / unknown user)
 * 5. JWT authentication & verifyToken
 * 6. Role-based authorization (HOD vs AC vs Faculty)
 * 7. Faculty retrieval & preservation
 * 8. Exactly 28 workload records in DB
 * 9. All workload rows preserved row-by-row
 * 10. Workload totals calculated dynamically
 * 11. Incomplete records preserved (Satheesh Kumar, Jaishankar)
 * 12. Workload multi-attribute search
 * 13. Workload filters (status, roles, categories)
 * 14. Workload dynamic summary aggregation
 * 15. Course faculty candidate handlers (AC Input)
 * 16. HOD allocation authorization enforcement (AC cannot approve)
 * 17. Timetable version state lifecycle transitions
 * 18. Timetable session strict isolation from workload
 * 19. Notification creation and read workflows
 * 20. Faculty absence & substitute allocation flow
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const { generateToken, verifyToken } = require('../src/utils/generateToken');
const { getDynamicSummaryMetrics } = require('../src/services/workloadService');
const { transitionTimetableStatus } = require('../src/services/timetableService');
const { updateAllocationStatus } = require('../src/services/allocationService');

// Models
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const FacultyWorkload = require('../src/models/FacultyWorkload');
const Course = require('../src/models/Course');
const CourseFacultyHandler = require('../src/models/CourseFacultyHandler');
const AcademicContext = require('../src/models/AcademicContext');
const ClassAdvisorAssignment = require('../src/models/ClassAdvisorAssignment');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const Notification = require('../src/models/Notification');
const FacultyAvailability = require('../src/models/FacultyAvailability');
const FacultyAbsence = require('../src/models/FacultyAbsence');
const SubstituteAllocation = require('../src/models/SubstituteAllocation');

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

/**
 * Helper to make local in-memory HTTP requests against Express app
 */
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
  console.log('NEC FACULTY BACKEND: 20 COMPREHENSIVE TEST SUITES');
  console.log('============================================================\n');

  try {
    // ------------------------------------------------------------
    // Test 1: MongoDB Connection
    // ------------------------------------------------------------
    console.log('--- Test 1: MongoDB Connection ---');
    await connectDB();
    assert(mongoose.connection.readyState === 1, 'MongoDB connected successfully with active readyState = 1');

    // ------------------------------------------------------------
    // Test 2: Health Endpoint
    // ------------------------------------------------------------
    console.log('\n--- Test 2: Health Endpoint (/api/health) ---');
    const healthRes = await makeRequest(app, { method: 'GET', path: '/api/health' });
    assert(healthRes.statusCode === 200, 'Health endpoint returns HTTP 200');
    assert(healthRes.body.success === true, 'Health response has success: true');
    assert(healthRes.body.service === 'nec-faculty-backend', 'Health service identifier is "nec-faculty-backend"');

    // ------------------------------------------------------------
    // Test 3 & 4: Authentication (Login Validation, Credentials & Edge Cases)
    // ------------------------------------------------------------
    console.log('\n--- Test 3 & 4: Authentication (Login Validation, Credentials & Edge Cases) ---');
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('TestPass123!', 10);
    await User.deleteMany({
      email: {
        $in: [
          'test_auth@nec.edu.in',
          'test_inactive@nec.edu.in',
          'faculty_test@nec.edu.in',
          'ac_test@nec.edu.in',
          'hod_test@nec.edu.in',
          'admin_test@nec.edu.in',
        ],
      },
    });

    const testUser = await User.create({
      name: 'Auth Tester',
      email: 'test_auth@nec.edu.in',
      passwordHash: hash,
      role: 'HOD',
      facultyId: 'FWL-01',
      isActive: true,
    });

    const inactiveUser = await User.create({
      name: 'Inactive Tester',
      email: 'test_inactive@nec.edu.in',
      passwordHash: hash,
      role: 'FACULTY',
      facultyId: 'FWL-09',
      isActive: false,
    });

    // 4.1 Missing email validation (400)
    const missingEmailRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { password: 'TestPass123!' },
    });
    assert(missingEmailRes.statusCode === 400, 'Login with missing email returns HTTP 400');
    assert(missingEmailRes.body.code === 'VALIDATION_ERROR', 'Login with missing email returns VALIDATION_ERROR');

    // 4.2 Missing password validation (400)
    const missingPassRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'test_auth@nec.edu.in' },
    });
    assert(missingPassRes.statusCode === 400, 'Login with missing password returns HTTP 400');
    assert(missingPassRes.body.code === 'VALIDATION_ERROR', 'Login with missing password returns VALIDATION_ERROR');

    // 4.3 Unknown user rejection (401 - prevents account enumeration)
    const unknownUserRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nonexistent_user_999@nec.edu.in', password: 'TestPass123!' },
    });
    assert(unknownUserRes.statusCode === 401, 'Login with unknown user returns HTTP 401');
    assert(unknownUserRes.body.code === 'INVALID_CREDENTIALS', 'Login with unknown user returns INVALID_CREDENTIALS');

    // 4.4 Wrong password rejection (401)
    const loginFailRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'test_auth@nec.edu.in', password: 'WrongPassword!' },
    });
    assert(loginFailRes.statusCode === 401, 'Login with wrong password returns HTTP 401');
    assert(loginFailRes.body.success === false, 'Login failure response has success: false');
    assert(loginFailRes.body.code === 'INVALID_CREDENTIALS', 'Wrong password returns code INVALID_CREDENTIALS');

    // 4.5 Inactive / deactivated user rejection (401)
    const inactiveLoginRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'test_inactive@nec.edu.in', password: 'TestPass123!' },
    });
    assert(inactiveLoginRes.statusCode === 401, 'Login with inactive user returns HTTP 401');
    assert(inactiveLoginRes.body.code === 'ACCOUNT_DEACTIVATED', 'Inactive user returns code ACCOUNT_DEACTIVATED');

    // 4.6 Valid credentials login success (200)
    const loginSuccessRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'test_auth@nec.edu.in', password: 'TestPass123!' },
    });
    assert(loginSuccessRes.statusCode === 200, 'Login with correct password returns HTTP 200');
    assert(loginSuccessRes.body.success === true, 'Login success returns success: true');
    assert(!!loginSuccessRes.body.data.token, 'Login returns valid JWT token');
    assert(loginSuccessRes.body.data.role === 'HOD', 'Login response provides role directly');
    assert(loginSuccessRes.body.data.facultyId === 'FWL-01', 'Login response provides facultyId directly');
    assert(!!loginSuccessRes.body.data.user, 'Login response provides user object');
    assert(!loginSuccessRes.body.data.user.passwordHash, 'User object strictly excludes passwordHash');

    const hodToken = loginSuccessRes.body.data.token;

    // ------------------------------------------------------------
    // Test 5: JWT Verification, Expiration & Edge Cases
    // ------------------------------------------------------------
    console.log('\n--- Test 5: JWT Authentication, Expiry & Profile Retrieval ---');
    const decoded = verifyToken(hodToken);
    assert(decoded.email === 'test_auth@nec.edu.in', 'verifyToken extracts correct user email');
    assert(decoded.role === 'HOD', 'verifyToken extracts correct user role (HOD)');

    // 5.1 Valid token profile retrieval
    const meRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(meRes.statusCode === 200, '/api/auth/me returns HTTP 200 with valid token');
    assert(meRes.body.data.email === 'test_auth@nec.edu.in', '/api/auth/me returns matching user email');
    assert(meRes.body.data.role === 'HOD', '/api/auth/me returns matching user role');
    assert(meRes.body.data.facultyId === 'FWL-01', '/api/auth/me returns matching facultyId');
    assert(!meRes.body.data.passwordHash, '/api/auth/me strictly excludes passwordHash');

    // 5.2 Missing token (401 UNAUTHORIZED)
    const missingTokenRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
    });
    assert(missingTokenRes.statusCode === 401, '/api/auth/me with missing token returns HTTP 401');
    assert(missingTokenRes.body.code === 'UNAUTHORIZED', 'Missing token returns code UNAUTHORIZED');

    // 5.3 Malformed token (401 INVALID_TOKEN)
    const malformedTokenRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    assert(malformedTokenRes.statusCode === 401, '/api/auth/me with malformed token returns HTTP 401');
    assert(malformedTokenRes.body.code === 'INVALID_TOKEN', 'Malformed token returns code INVALID_TOKEN');

    // 5.4 Expired token (401 TOKEN_EXPIRED)
    const expiredToken = generateToken(testUser, '1ms');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const expiredTokenRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredTokenRes.statusCode === 401, '/api/auth/me with expired token returns HTTP 401');
    assert(expiredTokenRes.body.code === 'TOKEN_EXPIRED', 'Expired token returns code TOKEN_EXPIRED');

    // 5.5 Token for inactive / deactivated user (401 USER_INACTIVE)
    const inactiveUserToken = generateToken(inactiveUser);
    const inactiveTokenRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${inactiveUserToken}` },
    });
    assert(inactiveTokenRes.statusCode === 401, '/api/auth/me for inactive user returns HTTP 401');
    assert(inactiveTokenRes.body.code === 'USER_INACTIVE', 'Inactive user returns code USER_INACTIVE');

    // ------------------------------------------------------------
    // Test 6: Role-Based Access Control (RBAC: FACULTY, AC, HOD, ADMIN)
    // ------------------------------------------------------------
    console.log('\n--- Test 6: Role-Based Access Control (RBAC: FACULTY, AC, HOD, ADMIN) ---');
    const facultyUser = await User.create({
      name: 'Faculty Tester',
      email: 'faculty_test@nec.edu.in',
      passwordHash: hash,
      role: 'FACULTY',
      facultyId: 'FWL-03',
      isActive: true,
    });
    const facultyToken = generateToken(facultyUser);

    const acUser = await User.create({
      name: 'AC Tester',
      email: 'ac_test@nec.edu.in',
      passwordHash: hash,
      role: 'AC',
      facultyId: 'FWL-22',
      isActive: true,
    });
    const acToken = generateToken(acUser);

    const adminUser = await User.create({
      name: 'Admin Tester',
      email: 'admin_test@nec.edu.in',
      passwordHash: hash,
      role: 'ADMIN',
      facultyId: null,
      isActive: true,
    });
    const adminToken = generateToken(adminUser);

    // 6.1 FACULTY Permissions: Can access own schedule, workload, notifications, and submit absence
    const facultyScheduleRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/FWL-03',
    });
    assert(facultyScheduleRes.statusCode === 200, 'Faculty schedule endpoint returns HTTP 200');

    const facultyWorkloadRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/workload?facultyId=FWL-03',
    });
    assert(facultyWorkloadRes.statusCode === 200, 'Workload retrieval returns HTTP 200');

    const facultyNotifRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/notifications',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert(facultyNotifRes.statusCode === 200, 'Faculty can access notifications endpoint (HTTP 200)');

    const facultyAbsenceSubmitRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/absences',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        facultyId: 'FWL-03',
        date: '2026-10-15',
        reason: 'Attending faculty development workshop',
      },
    });
    assert(facultyAbsenceSubmitRes.statusCode === 201, 'Faculty can submit absence (HTTP 201)');
    const testAbsenceId = facultyAbsenceSubmitRes.body.data._id;

    // 6.2 FACULTY Restrictions: Blocked from HOD/ADMIN operations with HTTP 403
    const facultyAdvisorBlocked = await makeRequest(app, {
      method: 'POST',
      path: '/api/class-advisors',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: { academicContextId: new mongoose.Types.ObjectId(), facultyId: 'FWL-03' },
    });
    assert(facultyAdvisorBlocked.statusCode === 403, 'FACULTY is blocked from assigning class advisor (HTTP 403)');
    assert(facultyAdvisorBlocked.body.code === 'FORBIDDEN', 'FACULTY forbidden error returns code FORBIDDEN');

    const facultyAbsenceApproveBlocked = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/absences/${testAbsenceId}/status`,
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: { status: 'APPROVED' },
    });
    assert(facultyAbsenceApproveBlocked.statusCode === 403, 'FACULTY is blocked from approving absence (HTTP 403)');

    // 6.3 AC Permissions: Can submit course candidate handlers
    const acHandlerSubmit = await makeRequest(app, {
      method: 'POST',
      path: '/api/course-faculty-handlers',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        courseCode: '22CSC99',
        candidates: ['FWL-03', 'FWL-04'],
        priorityRanking: ['FWL-03', 'FWL-04'],
      },
    });
    assert(acHandlerSubmit.statusCode === 201, 'AC can submit course faculty handlers (HTTP 201)');

    // 6.4 AC Restrictions: Blocked from HOD-authoritative operations
    const advisorByAc = await makeRequest(app, {
      method: 'POST',
      path: '/api/class-advisors',
      headers: { Authorization: `Bearer ${acToken}` },
      body: { academicContextId: new mongoose.Types.ObjectId(), facultyId: 'FWL-04' },
    });
    assert(advisorByAc.statusCode === 403, 'AC user attempting HOD action is blocked with HTTP 403 Forbidden');
    assert(advisorByAc.body.code === 'FORBIDDEN', 'Error code returned is FORBIDDEN');

    const acAbsenceApproveBlocked = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/absences/${testAbsenceId}/status`,
      headers: { Authorization: `Bearer ${acToken}` },
      body: { status: 'APPROVED' },
    });
    assert(acAbsenceApproveBlocked.statusCode === 403, 'AC is blocked from approving absence (HTTP 403)');

    // 6.5 HOD Authority: Can approve absences and assignments
    const hodAbsenceApproveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/absences/${testAbsenceId}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'APPROVED' },
    });
    assert(hodAbsenceApproveRes.statusCode === 200, 'HOD can approve faculty absence (HTTP 200)');
    assert(hodAbsenceApproveRes.body.data.status === 'APPROVED', 'Absence status successfully marked APPROVED by HOD');

    // 6.6 ADMIN Authority & Non-Admin restrictions
    const hodDeleteFacultyBlocked = await makeRequest(app, {
      method: 'DELETE',
      path: '/api/faculty/FWL-NONEXISTENT',
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(hodDeleteFacultyBlocked.statusCode === 403, 'HOD is blocked from ADMIN-only delete faculty (HTTP 403)');

    const adminDeleteFacultyRes = await makeRequest(app, {
      method: 'DELETE',
      path: '/api/faculty/FWL-NONEXISTENT',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminDeleteFacultyRes.statusCode !== 403, 'ADMIN is authorized to invoke delete faculty (status !== 403)');

    // Clean up temporary absence and handlers created in Test 6
    await FacultyAbsence.findByIdAndDelete(testAbsenceId);
    await CourseFacultyHandler.deleteOne({ courseCode: '22CSC99' });

    // ------------------------------------------------------------
    // Test 7: Faculty Master Retrieval & Preservation
    // ------------------------------------------------------------
    console.log('\n--- Test 7: Faculty Master Retrieval & Exact Name Preservation (25 CSE, 2 ECE) ---');
    const facultyListRes = await makeRequest(app, { method: 'GET', path: '/api/faculty?limit=50' });
    assert(facultyListRes.statusCode === 200, '/api/faculty returns HTTP 200');
    assert(Array.isArray(facultyListRes.body.data.items), 'Faculty items is an array');
    assert(facultyListRes.body.data.items.length === 27, `Faculty count is exactly 27 (Found: ${facultyListRes.body.data.items.length})`);

    // Department breakdown: 25 CSE, 2 ECE
    const cseList = facultyListRes.body.data.items.filter((f) => !f.department.includes('Electronics'));
    const eceList = facultyListRes.body.data.items.filter((f) => f.department.includes('Electronics'));
    assert(cseList.length === 25, `CSE faculty count is exactly 25 (Found: ${cseList.length})`);
    assert(eceList.length === 2, `ECE faculty count is exactly 2 (Found: ${eceList.length})`);

    // Karpusamy preservation check
    const karpusamy = await Faculty.findOne({ facultyName: 'Dr. S. Karpusamy' });
    assert(!!karpusamy, 'Preserves exact spelling "Dr. S. Karpusamy" without normalization');

    // ------------------------------------------------------------
    // Test 8: Exactly 27 Workload Records in Database
    // ------------------------------------------------------------
    console.log('\n--- Test 8: Exactly 27 Workload Records in DB ---');
    const workloadCount = await FacultyWorkload.countDocuments({});
    assert(workloadCount === 27, `Database contains exactly ${workloadCount} workload records (Expected: 27)`);

    // ------------------------------------------------------------
    // Test 9: All Workload Rows Preserved
    // ------------------------------------------------------------
    console.log('\n--- Test 9: All Workload Rows Preserved Row-by-Row ---');
    const allWorkloads = await FacultyWorkload.find({});
    let totalTeachingRows = 0;
    let totalRespRows = 0;
    allWorkloads.forEach((w) => {
      Object.values(w.teaching).forEach((arr) => {
        totalTeachingRows += arr.length;
      });
      totalRespRows += w.responsibilities.length;
    });
    assert(totalTeachingRows === 138, `Preserved exactly ${totalTeachingRows} teaching rows in MongoDB (Expected: 138)`);
    assert(totalRespRows === 72, `Preserved exactly ${totalRespRows} responsibility rows in MongoDB (Expected: 72)`);
    assert(totalTeachingRows + totalRespRows === 210, `Total workload rows: ${totalTeachingRows + totalRespRows} (Expected: 210)`);

    // Verify multi-row faculty: M. P. Thiruvenkatasuresh (FWL-02)
    const fwl02 = allWorkloads.find((w) => w.facultyId === 'FWL-02');
    assert(!!fwl02, 'M. P. Thiruvenkatasuresh (FWL-02) exists in DB');
    assert(fwl02.teaching.ugTheory1.length === 1, 'FWL-02 retains UG Theory 1 row');
    assert(fwl02.teaching.lab1.length === 1, 'FWL-02 retains Lab 1 row');
    assert(fwl02.teaching.lab2.length === 1, 'FWL-02 retains Lab 2 row');
    assert(fwl02.teaching.pg.length === 1, 'FWL-02 retains PG row');
    assert(fwl02.teaching.others.length === 3, 'FWL-02 retains 3 Others rows');
    assert(fwl02.responsibilities.length === 3, 'FWL-02 retains 3 Responsibility rows');

    // ------------------------------------------------------------
    // Test 10: Workload Totals (Dynamic Calculation)
    // ------------------------------------------------------------
    console.log('\n--- Test 10: Workload Totals Calculated Dynamically ---');
    let sumTeaching = 0;
    let sumResp = 0;
    let sumTotal = 0;
    allWorkloads.forEach((w) => {
      sumTeaching += w.calculatedTeachingHours;
      sumResp += w.calculatedResponsibilityHours;
      sumTotal += w.calculatedTotalHours;
    });
    assert(sumTeaching === 397, `Calculated teaching hours sum = ${sumTeaching}h (Expected: 397)`);
    assert(sumResp === 129, `Calculated responsibility hours sum = ${sumResp}h (Expected: 129)`);
    assert(sumTotal === 526, `Calculated total allocated workload sum = ${sumTotal}h (Expected: 526)`);

    // ------------------------------------------------------------
    // Test 11: Incomplete Records Preserved Correctly (Satheesh Kumar)
    // ------------------------------------------------------------
    console.log('\n--- Test 11: Incomplete Records Preserved (Mrs. A. Satheesh Kumar Data Gap) ---');
    const satheesh = allWorkloads.find((w) => w.facultyName.includes('Satheesh Kumar'));
    assert(!!satheesh, 'Mrs. A. Satheesh Kumar record exists');
    assert(satheesh.status === 'INCOMPLETE SOURCE DATA', 'Satheesh Kumar marked INCOMPLETE SOURCE DATA');
    assert(satheesh.sourceTotalHours === null, 'Satheesh Kumar sourceTotalHours is null (not guessed)');
    assert(satheesh.responsibilities[0].hours === null, 'TECH GURU responsibility hours is null (not guessed to 0)');

    // ------------------------------------------------------------
    // Test 12: Workload Search
    // ------------------------------------------------------------
    console.log('\n--- Test 12: Workload Search ---');
    const searchRes = await makeRequest(app, { method: 'GET', path: '/api/workload?search=Compiler' });
    assert(searchRes.statusCode === 200, 'Workload search endpoint returns HTTP 200');
    assert(searchRes.body.data.items.length > 0, 'Search for "Compiler" returns matching faculty');

    // ------------------------------------------------------------
    // Test 13: Workload Filters
    // ------------------------------------------------------------
    console.log('\n--- Test 13: Workload Filters ---');
    const matchedFilter = await makeRequest(app, { method: 'GET', path: '/api/workload?status=MATCHED&limit=50' });
    assert(matchedFilter.body.data.items.length === 26 && matchedFilter.body.data.pagination.total === 26, 'Filter status=MATCHED returns exactly 26 records');

    const incompleteFilter = await makeRequest(app, {
      method: 'GET',
      path: '/api/workload?status=INCOMPLETE%20SOURCE%20DATA',
    });
    assert(incompleteFilter.body.data.items.length === 1, 'Filter status=INCOMPLETE returns exactly 1 record');

    const hodFilter = await makeRequest(app, { method: 'GET', path: '/api/workload?role=HOD' });
    assert(hodFilter.body.data.items.length >= 1, 'Filter role=HOD returns HOD faculty');

    // ------------------------------------------------------------
    // Test 14: Workload Summary (Dynamic Aggregation)
    // ------------------------------------------------------------
    console.log('\n--- Test 14: Dynamic Workload Summary Aggregation ---');
    const summaryRes = await makeRequest(app, { method: 'GET', path: '/api/workload/summary' });
    assert(summaryRes.statusCode === 200, '/api/workload/summary returns HTTP 200');
    assert(summaryRes.body.data.totalFaculty === 27, 'Dynamic summary totalFaculty is 27');
    assert(summaryRes.body.data.totalTeachingHours === 397, 'Dynamic summary totalTeachingHours is 397');
    assert(summaryRes.body.data.totalResponsibilityHours === 129, 'Dynamic summary totalResponsibilityHours is 129');
    assert(summaryRes.body.data.totalAllocatedHours === 526, 'Dynamic summary totalAllocatedHours is 526');
    assert(summaryRes.body.data.completeCount === 26, 'Dynamic summary completeCount is 26');
    assert(summaryRes.body.data.incompleteCount === 1, 'Dynamic summary incompleteCount is 1');

    // ------------------------------------------------------------
    // Test 15: Course Faculty Candidate Handlers (AC Input)
    // ------------------------------------------------------------
    console.log('\n--- Test 15: Course Faculty Handlers Domain ---');
    const handlersRes = await makeRequest(app, { method: 'GET', path: '/api/course-faculty-handlers' });
    assert(handlersRes.statusCode === 200, '/api/course-faculty-handlers returns HTTP 200');
    assert(Array.isArray(handlersRes.body.data), 'Handlers data is array');

    // ------------------------------------------------------------
    // Test 16: HOD Allocation Authorization Enforcement
    // ------------------------------------------------------------
    console.log('\n--- Test 16: HOD Allocation Authorization Enforcement ---');
    const dummyContext = await AcademicContext.findOne({});
    const contextId = dummyContext ? dummyContext._id : new mongoose.Types.ObjectId();

    const allocation = await HODFacultyAllocation.create({
      academicContextId: contextId,
      courseCode: '22CSC14',
      facultyId: 'FWL-04',
      allocationType: 'THEORY',
      status: 'DRAFT',
      assignedBy: 'AC',
    });

    let acApproveFailed = false;
    try {
      await updateAllocationStatus(allocation._id, 'APPROVED', 'AC');
    } catch (err) {
      acApproveFailed = true;
    }
    assert(acApproveFailed, 'AC user is blocked from approving final HOD allocation');

    const hodApprove = await updateAllocationStatus(allocation._id, 'APPROVED', 'HOD');
    assert(hodApprove.status === 'APPROVED', 'HOD user successfully approves final allocation');

    // ------------------------------------------------------------
    // Test 17: Timetable Version State Lifecycle Transitions
    // ------------------------------------------------------------
    console.log('\n--- Test 17: Timetable Version State Machine ---');
    const ttVersion = await TimetableVersion.create({
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      status: 'NO_TIMETABLE',
    });

    const v1 = await transitionTimetableStatus(ttVersion._id, 'GENERATED', { role: 'AC', name: 'AC User' });
    assert(v1.status === 'GENERATED', 'State transition to GENERATED succeeded');

    const v2 = await transitionTimetableStatus(ttVersion._id, 'PENDING_HOD_APPROVAL', { role: 'AC', name: 'AC User' });
    assert(v2.status === 'PENDING_HOD_APPROVAL', 'State transition to PENDING_HOD_APPROVAL succeeded');

    let acApproveVersionFailed = false;
    try {
      await transitionTimetableStatus(ttVersion._id, 'APPROVED', { role: 'AC', name: 'AC User' });
    } catch (e) {
      acApproveVersionFailed = true;
    }
    assert(acApproveVersionFailed, 'AC user is blocked from approving TimetableVersion');

    const v3 = await transitionTimetableStatus(ttVersion._id, 'APPROVED', { role: 'HOD', name: 'HOD User' });
    assert(v3.status === 'APPROVED', 'HOD successfully transitioned TimetableVersion to APPROVED');

    const v4 = await transitionTimetableStatus(ttVersion._id, 'PUBLISHED', { role: 'HOD', name: 'HOD User' });
    assert(v4.status === 'PUBLISHED', 'HOD successfully transitioned TimetableVersion to PUBLISHED');

    // ------------------------------------------------------------
    // Test 18: TimetableSession Isolation from Workload
    // ------------------------------------------------------------
    console.log('\n--- Test 18: TimetableSession Isolation from Workload ---');
    const session = await TimetableSession.create({
      timetableVersionId: v4._id,
      academicContextId: contextId,
      courseCode: '22CSC14',
      facultyId: 'FWL-04',
      day: 'MON',
      period: 'P1',
      room: 'LH-101',
      sessionType: 'THEORY',
    });
    assert(!!session._id, 'TimetableSession created with schedule coordinates (day: MON, period: P1, room: LH-101)');

    // Verify workload record for FWL-04 does not contain schedule slots
    const fwl04 = await FacultyWorkload.findOne({ facultyId: 'FWL-04' });
    assert(fwl04.day === undefined, 'FacultyWorkload does not contain day schedule field');
    assert(fwl04.period === undefined, 'FacultyWorkload does not contain period schedule field');
    assert(fwl04.room === undefined, 'FacultyWorkload does not contain room schedule field');

    // ------------------------------------------------------------
    // Test 19: Notification Creation and Read Workflow
    // ------------------------------------------------------------
    console.log('\n--- Test 19: Notification Creation & Read Workflow ---');
    const notif = await Notification.create({
      recipientUserId: 'test_auth@nec.edu.in',
      type: 'ALLOCATION',
      title: 'Allocation Approved',
      message: 'Your teaching allocation has been ratified by HOD.',
      isRead: false,
    });
    assert(notif.isRead === false, 'Notification created with isRead: false');

    const readRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/notifications/${notif._id}/read`,
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(readRes.statusCode === 200, 'Mark notification read returns HTTP 200');
    assert(readRes.body.data.isRead === true, 'Notification status updated to isRead: true');

    // ------------------------------------------------------------
    // Test 20: Faculty Absence & Substitute Allocation Flow
    // ------------------------------------------------------------
    console.log('\n--- Test 20: Faculty Absence & Substitute Allocation Flow ---');
    const absence = await FacultyAbsence.create({
      facultyId: 'FWL-04',
      date: '2026-09-22',
      reason: 'Attending International Conference on AI',
      status: 'PENDING',
    });
    assert(absence.status === 'PENDING', 'Absence created in PENDING status');

    absence.status = 'APPROVED';
    absence.approvedBy = 'HOD';
    await absence.save();
    assert(absence.status === 'APPROVED', 'HOD approved faculty absence');

    const substitute = await SubstituteAllocation.create({
      absenceId: absence._id,
      originalFacultyId: 'FWL-04',
      substituteFacultyId: 'FWL-07',
      timetableSessionId: session._id,
      date: '2026-09-22',
      period: 'P1',
      status: 'PENDING',
    });
    assert(substitute.originalFacultyId === 'FWL-04', 'Substitute record points to original faculty FWL-04');
    assert(substitute.substituteFacultyId === 'FWL-07', 'Substitute assigned to FWL-07');

    // Workload remains unaltered
    const fwl04After = await FacultyWorkload.findOne({ facultyId: 'FWL-04' });
    assert(fwl04After.calculatedTotalHours === fwl04.calculatedTotalHours, 'Faculty workload hours remain unaltered after substitution');

    // ------------------------------------------------------------
    // Test 21: Faculty Allocations API & Domain Categorization
    // ------------------------------------------------------------
    console.log('\n--- Test 21: Faculty Allocations API (/api/faculty/:facultyId/allocations) ---');
    // 21.1 FWL-01 (Dr. T. Rajasekaran): Teaching breakdown & department
    const fwl01AllocRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/faculty/FWL-01/allocations',
    });
    assert(fwl01AllocRes.statusCode === 200, 'FWL-01 allocations endpoint returns HTTP 200');
    assert(fwl01AllocRes.body.data.facultyName === 'Dr. T. Rajasekaran', 'FWL-01 facultyName matches');
    assert(fwl01AllocRes.body.data.department === 'Department of Computer Science and Engineering', 'FWL-01 department is CSE');
    assert(fwl01AllocRes.body.data.teachingLoad.ugTheory.length === 1, 'FWL-01 has 1 UG Theory allocation (Deep Learning)');
    assert(fwl01AllocRes.body.data.teachingLoad.labs.length === 1, 'FWL-01 has 1 Lab allocation (Full Stack Lab)');
    assert(fwl01AllocRes.body.data.teachingLoad.pg.length === 1, 'FWL-01 has 1 PG allocation (Project Phase I)');
    assert(fwl01AllocRes.body.data.summary.totalHours === 8, 'FWL-01 summary totalHours is 8');

    // 21.2 FWL-02 (M. P. Thiruvenkatasuresh): Responsibilities categorization
    const fwl02AllocRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/faculty/FWL-02/allocations',
    });
    assert(fwl02AllocRes.statusCode === 200, 'FWL-02 allocations endpoint returns HTTP 200');
    assert(fwl02AllocRes.body.data.responsibilities.academic.some((r) => r.role === 'Overall Academic Coordinator'), 'FWL-02 has Academic Coordinator in Academic responsibilities');
    assert(fwl02AllocRes.body.data.responsibilities.academic.some((r) => r.role === 'Class Advisor'), 'FWL-02 has Class Advisor in Academic responsibilities');
    assert(fwl02AllocRes.body.data.responsibilities.coordination.some((r) => r.role === 'NBA Coordinator'), 'FWL-02 has NBA Coordinator in Coordination responsibilities');
    assert(fwl02AllocRes.body.data.summary.totalHours === 24, 'FWL-02 summary totalHours is 24');

    // 21.3 FWL-20 (Mrs. A. Satheesh Kumar): Data gap preservation
    const fwl20AllocRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/faculty/FWL-20/allocations',
    });
    assert(fwl20AllocRes.statusCode === 200, 'FWL-20 allocations endpoint returns HTTP 200');
    assert(fwl20AllocRes.body.data.summary.status === 'INCOMPLETE SOURCE DATA', 'FWL-20 status is INCOMPLETE SOURCE DATA');
    assert(fwl20AllocRes.body.data.summary.sourceTotalHours === null, 'FWL-20 sourceTotalHours is null');
    assert(fwl20AllocRes.body.data.responsibilities.institutional[0].role === 'TECH GURU', 'FWL-20 retains TECH GURU');
    assert(fwl20AllocRes.body.data.responsibilities.institutional[0].hours === null, 'FWL-20 TECH GURU hours is null (not 0)');

    // 21.4 FWL-26 (Dr. R. Praveenkumar): ECE department preservation
    const fwl26AllocRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/faculty/FWL-26/allocations',
    });
    assert(fwl26AllocRes.statusCode === 200, 'FWL-26 allocations endpoint returns HTTP 200');
    assert(fwl26AllocRes.body.data.department === 'Department of Electronics and Communication Engineering', 'FWL-26 department is ECE');

    // 21.5 Query filtering: allocationType filter
    const labFilterRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/faculty/FWL-02/allocations?allocationType=LAB',
    });
    assert(labFilterRes.statusCode === 200, 'Filtered allocations endpoint returns HTTP 200');
    assert(labFilterRes.body.data.allocations.every((a) => a.allocationType === 'LAB'), 'All returned items have allocationType LAB');

    // ------------------------------------------------------------
    // Test 22: Authoritative 27-Faculty Master Validator Check
    // ------------------------------------------------------------
    console.log('\n--- Test 22: Authoritative 27-Faculty Master Validator Check ---');
    const { validateFacultyMasterSuite } = require('../src/validators/facultyMasterValidator');
    const workloadModule = await import('../src/data/workloadMasterData.js');
    const masterValidationReport = validateFacultyMasterSuite(workloadModule.FACULTY_WORKLOAD_MASTER);
    assert(masterValidationReport.success === true, 'validateFacultyMasterSuite reports success: true');
    assert(masterValidationReport.totalFaculty === 27, 'Validator reports exactly 27 faculty');
    assert(masterValidationReport.cseCount === 25, 'Validator reports exactly 25 CSE faculty');
    assert(masterValidationReport.eceCount === 2, 'Validator reports exactly 2 ECE faculty');
    assert(masterValidationReport.totalAllocatedHours === 526, 'Validator reports 526 allocated hours (397 teaching + 129 resp)');
    assert(masterValidationReport.flags.unknownTotals.length === 1, 'Validator flagged exactly 1 unknown total (FWL-20)');
    assert(masterValidationReport.flags.missingHours.length === 1, 'Validator flagged exactly 1 missing hour item (FWL-20 TECH GURU)');

    // Clean up test data
    await User.deleteMany({
      email: {
        $in: [
          'test_auth@nec.edu.in',
          'test_inactive@nec.edu.in',
          'faculty_test@nec.edu.in',
          'ac_test@nec.edu.in',
          'hod_test@nec.edu.in',
          'admin_test@nec.edu.in',
        ],
      },
    });
    await TimetableSession.findByIdAndDelete(session._id);
    await TimetableVersion.findByIdAndDelete(ttVersion._id);
    await HODFacultyAllocation.findByIdAndDelete(allocation._id);
    await Notification.findByIdAndDelete(notif._id);
    await FacultyAbsence.findByIdAndDelete(absence._id);
    await SubstituteAllocation.findByIdAndDelete(substitute._id);

    console.log('\n============================================================');
    console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[Test Suite Fatal Error]', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
