/**
 * Test Suite: HOD Add New Faculty + Workload Allocation
 *
 * Covers all required verification scenarios:
 * 1. Create faculty (HOD success with complete workload allocation)
 * 2. Invalid faculty data (missing facultyName, missing designation)
 * 3. UG theory allocation (valid persistence & validation of courseName/hours)
 * 4. Lab allocation (valid persistence & validation of courseName/hours)
 * 5. PG/Honours/Minor (each assigned course = 1 equivalent hour/week, >1 rejected)
 * 6. Others 1–3 (valid 1, 2, 3 hours/week)
 * 7. Others < 1 rejected
 * 8. Others > 3 rejected
 * 9. Responsibilities 1–6 (valid 1 to 6 hours/week)
 * 10. Responsibilities < 1 rejected
 * 11. Responsibilities > 6 rejected
 * 12. Duplicate responsibilities rejected
 * 13. Invalid responsibility role rejected (not in 38 master roles)
 * 14. Free-text responsibilities rejected
 * 15. HOD authorization permitted (HTTP 201)
 * 16. ADMIN authorization permitted (HTTP 201)
 * 17. Unauthorized role rejection (AC and FACULTY receive HTTP 403, no token receives HTTP 401)
 * 18. Server-authoritative workload calculation accuracy
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const { generateToken } = require('../src/utils/generateToken');

const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const FacultyWorkload = require('../src/models/FacultyWorkload');
const {
  validateFacultyCreationPayload,
} = require('../src/validators/facultyCreationValidators');
const {
  RESPONSIBILITY_MASTER_ROLES,
} = require('../src/constants/responsibilityMaster');

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

async function runFacultyCreationTests() {
  console.log('============================================================');
  console.log('HOD ADD NEW FACULTY + WORKLOAD ALLOCATION TEST SUITE');
  console.log('============================================================\n');

  try {
    await connectDB();

    // Setup Test Users for RBAC testing
    await User.deleteMany({
      email: {
        $in: [
          'test_hod_creation@nec.edu.in',
          'test_admin_creation@nec.edu.in',
          'test_ac_creation@nec.edu.in',
          'test_faculty_creation@nec.edu.in',
        ],
      },
    });

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Password123!', 10);

    const hodUser = await User.create({
      name: 'HOD Creation User',
      email: 'test_hod_creation@nec.edu.in',
      passwordHash: hash,
      role: 'HOD',
      facultyId: 'FWL-01',
      isActive: true,
    });

    const adminUser = await User.create({
      name: 'Admin Creation User',
      email: 'test_admin_creation@nec.edu.in',
      passwordHash: hash,
      role: 'ADMIN',
      isActive: true,
    });

    const acUser = await User.create({
      name: 'AC Creation User',
      email: 'test_ac_creation@nec.edu.in',
      passwordHash: hash,
      role: 'AC',
      facultyId: 'FWL-04',
      isActive: true,
    });

    const facultyUser = await User.create({
      name: 'Faculty Creation User',
      email: 'test_faculty_creation@nec.edu.in',
      passwordHash: hash,
      role: 'FACULTY',
      facultyId: 'FWL-06',
      isActive: true,
    });

    const hodToken = generateToken(hodUser);
    const adminToken = generateToken(adminUser);
    const acToken = generateToken(acUser);
    const facultyToken = generateToken(facultyUser);

    // Clean up any lingering test faculty records
    await Faculty.deleteMany({ facultyId: { $in: ['FWL-TEST-01', 'FWL-TEST-02', 'FWL-TEST-03', 'FWL-99'] } });
    await FacultyWorkload.deleteMany({ facultyId: { $in: ['FWL-TEST-01', 'FWL-TEST-02', 'FWL-TEST-03', 'FWL-99'] } });

    // ------------------------------------------------------------
    // 1. Validator Unit Tests
    // ------------------------------------------------------------
    console.log('--- 1. Validator Suite: Direct Payload Constraint Checks ---');

    // Invalid basic faculty data
    const errMissingName = validateFacultyCreationPayload({ designation: 'Assistant Professor' });
    assert(errMissingName.some((e) => e.includes('facultyName is required')), 'Missing facultyName flagged by validator');

    const errMissingDesig = validateFacultyCreationPayload({ facultyName: 'Dr. Test' });
    assert(errMissingDesig.some((e) => e.includes('designation is required')), 'Missing designation flagged by validator');

    // UG Theory validation
    const errUgNoCourseName = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      teaching: { ugTheory1: [{ hours: 3 }] },
    });
    assert(errUgNoCourseName.some((e) => e.includes('Missing courseName in ugTheory1')), 'UG Theory missing courseName rejected');

    const errUgNegHours = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      teaching: { ugTheory1: [{ courseName: 'Theory Course', hours: -1 }] },
    });
    assert(errUgNegHours.some((e) => e.includes('Invalid hours in ugTheory1')), 'UG Theory negative hours rejected');

    // Lab validation
    const errLabNoCourseName = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      teaching: { lab1: [{ hours: 4 }] },
    });
    assert(errLabNoCourseName.some((e) => e.includes('Missing courseName in lab1')), 'Lab missing courseName rejected');

    // PG / Honours / Minor: 1 equivalent hour/week rule
    const validPgPayload = {
      facultyName: 'Dr. Test',
      designation: 'AP',
      teaching: { pg: [{ courseName: 'PG Course' }] }, // hours omitted -> valid
    };
    assert(validateFacultyCreationPayload(validPgPayload).length === 0, 'PG course with omitted hours is valid (defaults to 1)');

    const validPgPayload1h = {
      facultyName: 'Dr. Test',
      designation: 'AP',
      teaching: { pg: [{ courseName: 'PG Course', hours: 1 }] },
    };
    assert(validateFacultyCreationPayload(validPgPayload1h).length === 0, 'PG course with explicit 1 hour is valid');

    const invalidPgPayload = {
      facultyName: 'Dr. Test',
      designation: 'AP',
      teaching: { pg: [{ courseName: 'PG Course', hours: 2 }] },
    };
    const errPg = validateFacultyCreationPayload(invalidPgPayload);
    assert(errPg.some((e) => e.includes('1 equivalent hour/week')), 'PG course with hours !== 1 rejected');

    // Others: 1–3 hours/week rule
    assert(
      validateFacultyCreationPayload({
        facultyName: 'Dr. Test',
        designation: 'AP',
        teaching: { others: [{ courseName: 'PBL', hours: 1 }] },
      }).length === 0,
      'Others with 1 hour is valid'
    );

    assert(
      validateFacultyCreationPayload({
        facultyName: 'Dr. Test',
        designation: 'AP',
        teaching: { others: [{ courseName: 'PBL', hours: 3 }] },
      }).length === 0,
      'Others with 3 hours is valid'
    );

    const errOthersBelow1 = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      teaching: { others: [{ courseName: 'PBL', hours: 0 }] },
    });
    assert(errOthersBelow1.some((e) => e.includes('Hours below 1 are rejected')), 'Others < 1 rejected');

    const errOthersAbove3 = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      teaching: { others: [{ courseName: 'PBL', hours: 4 }] },
    });
    assert(errOthersAbove3.some((e) => e.includes('Hours above 3 are rejected')), 'Others > 3 rejected');

    // Responsibilities: 1–6 hours/week rule
    assert(
      validateFacultyCreationPayload({
        facultyName: 'Dr. Test',
        designation: 'AP',
        responsibilities: [{ role: 'Class Advisor', hours: 1 }],
      }).length === 0,
      'Responsibilities with 1 hour is valid'
    );

    assert(
      validateFacultyCreationPayload({
        facultyName: 'Dr. Test',
        designation: 'AP',
        responsibilities: [{ role: 'NBA Coordinator', hours: 6 }],
      }).length === 0,
      'Responsibilities with 6 hours is valid'
    );

    const errRespBelow1 = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      responsibilities: [{ role: 'Proctor', hours: 0 }],
    });
    assert(errRespBelow1.some((e) => e.includes('Hours below 1 are rejected')), 'Responsibilities < 1 rejected');

    const errRespAbove6 = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      responsibilities: [{ role: 'Proctor', hours: 7 }],
    });
    assert(errRespAbove6.some((e) => e.includes('Hours above 6 are rejected')), 'Responsibilities > 6 rejected');

    // Duplicate responsibilities check
    const errDuplicateResp = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      responsibilities: [
        { role: 'Proctor', hours: 2 },
        { role: 'Proctor', hours: 3 },
      ],
    });
    assert(
      errDuplicateResp.some((e) => e.includes('Duplicate responsibility') && e.includes('Proctor')),
      'Duplicate responsibilities rejected'
    );

    const errDuplicateCaseInsensitive = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      responsibilities: [
        { role: 'class advisor', hours: 2 },
        { role: 'Class Advisor', hours: 3 },
      ],
    });
    assert(
      errDuplicateCaseInsensitive.some((e) => e.includes('Duplicate responsibility')),
      'Duplicate responsibilities rejected across case variations'
    );

    // Invalid role (not in 38 master roles)
    const errInvalidRole = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      responsibilities: [{ role: 'Non-Existent Custom Duty', hours: 2 }],
    });
    assert(
      errInvalidRole.some((e) => e.includes('Must match one of the authoritative 38')),
      'Unrecognized responsibility role rejected'
    );

    // Free-text responsibilities check
    const errFreeText = validateFacultyCreationPayload({
      facultyName: 'Dr. Test',
      designation: 'AP',
      responsibilities: 'Class Advisor, Proctor',
    });
    assert(
      errFreeText.some((e) => e.includes('cannot be a free-text string')),
      'Free-text responsibilities strictly rejected'
    );

    // ------------------------------------------------------------
    // 2. HTTP Endpoint RBAC & Authorization Tests
    // ------------------------------------------------------------
    console.log('\n--- 2. HTTP Authorization & RBAC Enforcement ---');

    const testPayload = {
      facultyId: 'FWL-TEST-01',
      facultyName: 'Dr. Authorization Test',
      designation: 'Associate Professor',
      department: 'Department of Computer Science and Engineering',
      teaching: {
        ugTheory1: [{ courseCode: '22CS401', courseName: 'Operating Systems', allocation: 'UG II Year A', hours: 3 }],
      },
    };

    // Unauthenticated (no token) -> 401
    const unauthRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      body: testPayload,
    });
    assert(unauthRes.statusCode === 401, 'Unauthenticated request rejected with HTTP 401');

    // FACULTY role -> 403
    const facultyRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: testPayload,
    });
    assert(facultyRes.statusCode === 403, 'FACULTY role rejected with HTTP 403');
    assert(facultyRes.body.code === 'FORBIDDEN', 'FACULTY rejection returns FORBIDDEN error code');

    // AC role -> 403
    const acRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${acToken}` },
      body: testPayload,
    });
    assert(acRes.statusCode === 403, 'AC role rejected with HTTP 403');
    assert(acRes.body.code === 'FORBIDDEN', 'AC rejection returns FORBIDDEN error code');

    // ------------------------------------------------------------
    // 3. HTTP Validation Enforcement (via POST /api/faculty)
    // ------------------------------------------------------------
    console.log('\n--- 3. HTTP Validation Error Handling (HTTP 400 VALIDATION_ERROR) ---');

    // Invalid faculty data
    const httpInvalidDataRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { designation: 'Professor' }, // missing facultyName
    });
    assert(httpInvalidDataRes.statusCode === 400, 'Missing facultyName returns HTTP 400');
    assert(httpInvalidDataRes.body.code === 'VALIDATION_ERROR', 'Returns VALIDATION_ERROR error code');

    // Others < 1 rejected via HTTP
    const httpOthersLowRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyName: 'Dr. Test Low',
        designation: 'AP',
        teaching: {
          others: [{ courseName: 'PBL', hours: 0 }],
        },
      },
    });
    assert(httpOthersLowRes.statusCode === 400, 'Others < 1 returns HTTP 400');

    // Others > 3 rejected via HTTP
    const httpOthersHighRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyName: 'Dr. Test High',
        designation: 'AP',
        teaching: {
          others: [{ courseName: 'PBL', hours: 4 }],
        },
      },
    });
    assert(httpOthersHighRes.statusCode === 400, 'Others > 3 returns HTTP 400');

    // Responsibilities < 1 rejected via HTTP
    const httpRespLowRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyName: 'Dr. Test Resp Low',
        designation: 'AP',
        responsibilities: [{ role: 'Proctor', hours: 0 }],
      },
    });
    assert(httpRespLowRes.statusCode === 400, 'Responsibilities < 1 returns HTTP 400');

    // Responsibilities > 6 rejected via HTTP
    const httpRespHighRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyName: 'Dr. Test Resp High',
        designation: 'AP',
        responsibilities: [{ role: 'Proctor', hours: 7 }],
      },
    });
    assert(httpRespHighRes.statusCode === 400, 'Responsibilities > 6 returns HTTP 400');

    // Duplicate responsibilities rejected via HTTP
    const httpDuplicateRespRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyName: 'Dr. Test Duplicate',
        designation: 'AP',
        responsibilities: [
          { role: 'Proctor', hours: 2 },
          { role: 'Proctor', hours: 3 },
        ],
      },
    });
    assert(httpDuplicateRespRes.statusCode === 400, 'Duplicate responsibilities returns HTTP 400');

    // ------------------------------------------------------------
    // 4. Successful Faculty Creation & Persistence (HOD & ADMIN)
    // ------------------------------------------------------------
    console.log('\n--- 4. Successful Faculty Creation & Workload Persistence ---');

    // HOD creates faculty with full workload allocation
    const completeFacultyPayload = {
      facultyId: 'FWL-TEST-01',
      facultyName: 'Dr. K. Suresh Kumar',
      designation: 'Associate Professor',
      department: 'Department of Computer Science and Engineering',
      email: 'sureshkumar@nec.edu.in',
      phone: '9876543210',
      teaching: {
        ugTheory1: [
          { courseCode: '22CS501', courseName: 'Compiler Design', allocation: 'UG III Year A', hours: 3 },
        ],
        ugTheory2: [
          { courseCode: '22CS502', courseName: 'Cloud Computing', allocation: 'UG III Year B', hours: 3 },
        ],
        lab1: [
          { courseCode: '22CSP07', courseName: 'Compiler Design Laboratory', allocation: 'UG III Year A', hours: 4 },
        ],
        lab2: [
          { courseCode: '22CSP08', courseName: 'Cloud Computing Laboratory', allocation: 'UG III Year B', hours: 4 },
        ],
        pg: [
          { courseCode: '22CPB05', courseName: 'Advanced Distributed Systems', allocation: 'PG I Year' }, // 1 equivalent hour
        ],
        others: [
          { courseName: 'PBL / Mini Project', allocation: 'UG II Year A', hours: 2 }, // 1-3 hours
        ],
      },
      responsibilities: [
        { role: 'Class Advisor', allocation: 'UG III Year A', hours: 2 }, // 1-6 hours
        { role: 'Timetable Coordinator', allocation: 'Dept Level', hours: 3 }, // 1-6 hours
      ],
    };

    const hodCreateRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: completeFacultyPayload,
    });

    assert(hodCreateRes.statusCode === 201, 'HOD successfully creates faculty (HTTP 201)');
    const createdData = hodCreateRes.body.data;
    assert(createdData.facultyId === 'FWL-TEST-01', 'Faculty ID matches submitted FWL-TEST-01');
    assert(createdData.facultyName === 'Dr. K. Suresh Kumar', 'Faculty name preserved');
    assert(createdData.department === 'Department of Computer Science and Engineering', 'Department accurately set');

    // ------------------------------------------------------------
    // 5. Workload Calculation Authoritative Verification
    // ------------------------------------------------------------
    console.log('\n--- 5. Server-Authoritative Workload Calculation Verification ---');

    // Teaching Contact Hours: 3 (UG1) + 3 (UG2) + 4 (Lab1) + 4 (Lab2) + 1 (PG) + 2 (Others) = 17 hours
    // Responsibility Hours: 2 (Class Advisor) + 3 (Timetable Coordinator) = 5 hours
    // Total Hours: 17 + 5 = 22 hours
    const calc = createdData.workloadCalculation;
    assert(calc.calculatedTeachingHours === 17, `Teaching hours accurately calculated as 17 (got: ${calc.calculatedTeachingHours})`);
    assert(calc.calculatedResponsibilityHours === 5, `Responsibility hours accurately calculated as 5 (got: ${calc.calculatedResponsibilityHours})`);
    assert(calc.calculatedTotalHours === 22, `Total hours accurately calculated as 22 (got: ${calc.calculatedTotalHours})`);
    assert(calc.status === 'MATCHED', 'Workload status is MATCHED');

    // Verify Allocation Persistence in MongoDB
    const persistedFaculty = await Faculty.findOne({ facultyId: 'FWL-TEST-01' });
    assert(!!persistedFaculty, 'Faculty record successfully persisted in MongoDB');

    const persistedWorkload = await FacultyWorkload.findOne({ facultyId: 'FWL-TEST-01' });
    assert(!!persistedWorkload, 'FacultyWorkload record successfully persisted in MongoDB');
    assert(persistedWorkload.teaching.ugTheory1.length === 1, 'UG Theory 1 allocation persisted');
    assert(persistedWorkload.teaching.ugTheory2.length === 1, 'UG Theory 2 allocation persisted');
    assert(persistedWorkload.teaching.lab1.length === 1, 'Lab 1 allocation persisted');
    assert(persistedWorkload.teaching.lab2.length === 1, 'Lab 2 allocation persisted');
    assert(persistedWorkload.teaching.pg.length === 1, 'PG allocation persisted');
    assert(persistedWorkload.teaching.pg[0].hours === 1, 'PG course default 1 equivalent hour persisted');
    assert(persistedWorkload.teaching.others.length === 1, 'Others allocation persisted');
    assert(persistedWorkload.responsibilities.length === 2, '2 responsibilities persisted');
    assert(persistedWorkload.calculatedTotalHours === 22, 'Persisted workload calculatedTotalHours is 22');

    // ------------------------------------------------------------
    // 6. Automatic ID Generation & ADMIN Authorization
    // ------------------------------------------------------------
    console.log('\n--- 6. Automatic ID Generation & ADMIN Authorization ---');

    const adminAutoPayload = {
      facultyName: 'Mr. Auto Generated CSE',
      designation: 'Assistant Professor',
      teaching: {
        ugTheory1: [{ courseName: 'Mobile App Dev', hours: 3 }],
      },
      responsibilities: [{ role: 'Proctor', hours: 2 }],
    };

    const adminCreateRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: adminAutoPayload,
    });

    assert(adminCreateRes.statusCode === 201, 'ADMIN successfully creates faculty (HTTP 201)');
    const autoCreatedData = adminCreateRes.body.data;
    assert(/^FWL-\d+$/.test(autoCreatedData.facultyId), `Automatic sequential ID generated: ${autoCreatedData.facultyId}`);
    assert(autoCreatedData.workloadCalculation.calculatedTeachingHours === 3, 'Teaching hours is 3');
    assert(autoCreatedData.workloadCalculation.calculatedResponsibilityHours === 2, 'Responsibility hours is 2');
    assert(autoCreatedData.workloadCalculation.calculatedTotalHours === 5, 'Total hours is 5');

    // Clean up created auto faculty
    await Faculty.deleteOne({ facultyId: autoCreatedData.facultyId });
    await FacultyWorkload.deleteOne({ facultyId: autoCreatedData.facultyId });

    // ------------------------------------------------------------
    // 7. Duplicate Faculty Identity Rejection
    // ------------------------------------------------------------
    console.log('\n--- 7. Duplicate Faculty Identity Rejection ---');

    const duplicateRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/faculty',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyId: 'FWL-TEST-01', // Already exists from test 4
        facultyName: 'Dr. Duplicate Attempt',
        designation: 'Professor',
      },
    });
    assert(duplicateRes.statusCode === 409, 'Duplicate faculty ID returns HTTP 409');
    assert(duplicateRes.body.code === 'DUPLICATE_ID', 'Returns DUPLICATE_ID error code');

    // ------------------------------------------------------------
    // 8. Workload Allocation Save/Update API (PUT /api/workload/:facultyId)
    // ------------------------------------------------------------
    console.log('\n--- 8. Workload Allocation Save / Update API (PUT /api/workload/:facultyId) ---');

    // Validation rejection on PUT workload: Others < 1
    const putOthersLowRes = await makeRequest(app, {
      method: 'PUT',
      path: '/api/workload/FWL-TEST-01',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        teaching: {
          others: [{ courseName: 'PBL', hours: 0 }],
        },
      },
    });
    assert(putOthersLowRes.statusCode === 400, 'PUT workload with Others = 0 rejected with HTTP 400');

    // Validation rejection on PUT workload: Others > 3
    const putOthersHighRes = await makeRequest(app, {
      method: 'PUT',
      path: '/api/workload/FWL-TEST-01',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        teaching: {
          others: [{ courseName: 'PBL', hours: 4 }],
        },
      },
    });
    assert(putOthersHighRes.statusCode === 400, 'PUT workload with Others = 4 rejected with HTTP 400');

    // Validation rejection on PUT workload: Responsibility < 1
    const putRespLowRes = await makeRequest(app, {
      method: 'PUT',
      path: '/api/workload/FWL-TEST-01',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        responsibilities: [{ role: 'Proctor', hours: 0 }],
      },
    });
    assert(putRespLowRes.statusCode === 400, 'PUT workload with Responsibility = 0 rejected with HTTP 400');

    // Validation rejection on PUT workload: Responsibility > 6
    const putRespHighRes = await makeRequest(app, {
      method: 'PUT',
      path: '/api/workload/FWL-TEST-01',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        responsibilities: [{ role: 'Proctor', hours: 7 }],
      },
    });
    assert(putRespHighRes.statusCode === 400, 'PUT workload with Responsibility = 7 rejected with HTTP 400');

    // Validation rejection on PUT workload: Duplicate responsibilities
    const putDuplicateRespRes = await makeRequest(app, {
      method: 'PUT',
      path: '/api/workload/FWL-TEST-01',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        responsibilities: [
          { role: 'NBA Coordinator', hours: 3 },
          { role: 'NBA Coordinator', hours: 2 },
        ],
      },
    });
    assert(putDuplicateRespRes.statusCode === 400, 'PUT workload with duplicate responsibilities rejected with HTTP 400');

    // Unauthorized role rejection on PUT workload
    const putAcRes = await makeRequest(app, {
      method: 'PUT',
      path: '/api/workload/FWL-TEST-01',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        responsibilities: [{ role: 'Proctor', hours: 2 }],
      },
    });
    assert(putAcRes.statusCode === 403, 'AC role rejected on PUT workload with HTTP 403 Forbidden');

    // Valid HOD Workload Allocation Update
    const putValidRes = await makeRequest(app, {
      method: 'PUT',
      path: '/api/workload/FWL-TEST-01',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        teaching: {
          ugTheory1: [{ courseCode: '22CS501', courseName: 'Compiler Design', allocation: 'UG III Year A', hours: 3 }],
          ugTheory2: [],
          lab1: [{ courseCode: '22CSP07', courseName: 'Compiler Lab', allocation: 'UG III Year A', hours: 4 }],
          lab2: [],
          pg: [{ courseCode: '22CPB05', courseName: 'Advanced Distributed Systems', allocation: 'PG I Year', hours: 1 }],
          others: [{ courseName: 'Skill Dev', allocation: 'UG II Year A', hours: 3 }], // Others = 3 (valid max)
        },
        responsibilities: [
          { role: 'NBA Coordinator', allocation: 'Dept Level', hours: 6 }, // Resp = 6 (valid max)
        ],
      },
    });
    assert(putValidRes.statusCode === 200, 'HOD successfully updates workload allocation (HTTP 200)');
    const updatedWorkload = putValidRes.body.data;
    // New calculation: 3 (UG) + 4 (Lab) + 1 (PG) + 3 (Others) = 11 teaching hours; 6 resp hours = 17 total
    assert(updatedWorkload.calculatedTeachingHours === 11, 'Updated teaching hours is 11');
    assert(updatedWorkload.calculatedResponsibilityHours === 6, 'Updated responsibility hours is 6');
    assert(updatedWorkload.calculatedTotalHours === 17, 'Updated total hours is 17');
    assert(updatedWorkload.status === 'MATCHED', 'Updated status is MATCHED');

    // ------------------------------------------------------------
    // 9. Data Integrity & Retrieval Verification
    // ------------------------------------------------------------
    console.log('\n--- 9. Data Integrity & Unified Read Endpoints Verification ---');

    // GET /api/faculty/:facultyId
    const getFacRes = await makeRequest(app, { method: 'GET', path: '/api/faculty/FWL-TEST-01' });
    assert(getFacRes.statusCode === 200, 'GET /api/faculty/FWL-TEST-01 returns HTTP 200');
    assert(getFacRes.body.data.facultyName === 'Dr. K. Suresh Kumar', 'Faculty record exists and matches');

    // GET /api/workload/:facultyId
    const getWlRes = await makeRequest(app, { method: 'GET', path: '/api/workload/FWL-TEST-01' });
    assert(getWlRes.statusCode === 200, 'GET /api/workload/FWL-TEST-01 returns HTTP 200');
    assert(getWlRes.body.data.calculatedTotalHours === 17, 'Workload record exists with updated 17 hours');

    // GET /api/faculty/:facultyId/allocations
    const getAllocRes = await makeRequest(app, { method: 'GET', path: '/api/faculty/FWL-TEST-01/allocations' });
    assert(getAllocRes.statusCode === 200, 'GET /api/faculty/:facultyId/allocations returns HTTP 200');
    assert(getAllocRes.body.data.summary.totalHours === 17, 'Summary totalHours is 17');
    assert(getAllocRes.body.data.teachingLoad.others[0].hours === 3, 'Others allocation has 3 hours');
    assert(getAllocRes.body.data.responsibilities.coordination[0].role === 'NBA Coordinator', 'NBA Coordinator categorized under coordination');

    // Search returns new faculty
    const searchRes = await makeRequest(app, { method: 'GET', path: '/api/workload?search=Suresh' });
    assert(searchRes.statusCode === 200, 'Workload search returns HTTP 200');
    assert(
      searchRes.body.data.items.some((f) => f.facultyId === 'FWL-TEST-01'),
      'Newly created faculty appears in workload search results'
    );

    // ------------------------------------------------------------
    // 10. Existing 27-Faculty Master Register Integrity
    // ------------------------------------------------------------
    console.log('\n--- 10. Authoritative 27-Faculty Master Register Untouched Check ---');

    const originalMasterCount = await FacultyWorkload.countDocuments({
      facultyId: { $regex: /^FWL-(0[1-9]|1[0-9]|2[0-7])$/ },
    });
    assert(originalMasterCount === 27, `Baseline 27-faculty master records remain untouched (Found: ${originalMasterCount})`);

    const originalCSECount = await FacultyWorkload.countDocuments({
      facultyId: { $regex: /^FWL-(0[1-9]|1[0-9]|2[0-5])$/ },
      department: /Computer Science/i,
    });
    assert(originalCSECount === 25, `Baseline 25 CSE faculty records remain untouched (Found: ${originalCSECount})`);

    const originalECECount = await FacultyWorkload.countDocuments({
      facultyId: { $in: ['FWL-26', 'FWL-27'] },
      department: /Electronics/i,
    });
    assert(originalECECount === 2, `Baseline 2 ECE faculty records remain untouched (Found: ${originalECECount})`);

    // Clean up created test faculty
    await Faculty.deleteOne({ facultyId: 'FWL-TEST-01' });
    await FacultyWorkload.deleteOne({ facultyId: 'FWL-TEST-01' });

    // ------------------------------------------------------------
    // 11. Cleanup Test Users
    // ------------------------------------------------------------
    await Faculty.deleteMany({ facultyId: { $in: ['FWL-TEST-01', 'FWL-TEST-02', 'FWL-TEST-03'] } });
    await FacultyWorkload.deleteMany({ facultyId: { $in: ['FWL-TEST-01', 'FWL-TEST-02', 'FWL-TEST-03'] } });
    await User.deleteMany({
      email: {
        $in: [
          'test_hod_creation@nec.edu.in',
          'test_admin_creation@nec.edu.in',
          'test_ac_creation@nec.edu.in',
          'test_faculty_creation@nec.edu.in',
        ],
      },
    });

    console.log('\n============================================================');
    console.log(`FACULTY CREATION SUITE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('[Faculty Creation Test Fatal Error]', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runFacultyCreationTests();
}

module.exports = { runFacultyCreationTests };
