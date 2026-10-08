/**
 * Faculty Workload Limits & Institutional Roles Test Suite (B2 / B5)
 *
 * Validates authoritative server-side workload constraints:
 * 1. UG Theory: Max 2 courses per faculty (3rd rejected with THEORY_LOAD_LIMIT_EXCEEDED)
 * 2. UG Lab: Max 2 lab courses per faculty (3rd rejected with LAB_LOAD_LIMIT_EXCEEDED)
 * 3. PG / Honours: Max 1 subject per faculty (2nd rejected with PG_LOAD_LIMIT_EXCEEDED)
 * 4. Faculty creation validator rejects teaching.pg > 1
 * 5. Other academic activities: 1 to 3 hours/week (rejected if < 1 or > 3)
 * 6. Institutional responsibilities: 1 to 6 hours/week (rejected if 0 or > 6)
 * 7. Duplicate institutional responsibility prevention
 * 8. Authoritative 38 institutional responsibility roles
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
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const { generateToken } = require('../src/utils/generateToken');
const {
  validateFacultyCreationPayload,
  validateTeachingPayload,
  validateResponsibilitiesPayload,
} = require('../src/validators/facultyCreationValidators');
const { RESPONSIBILITY_MASTER_ROLES } = require('../src/constants/responsibilityMaster');

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
  console.log('FACULTY WORKLOAD LIMITS & INSTITUTIONAL ROLES TEST SUITE (B2/B5)');
  console.log('============================================================\n');

  await connectDB();

  const TEST_PREFIX = 'FWLTEST_';
  const hodEmail = `${TEST_PREFIX}hod@nec.edu.in`;
  const tcEmail = `${TEST_PREFIX}tc@nec.edu.in`;

  try {
    // Clean previous test run
    await User.deleteMany({ email: { $in: [hodEmail, tcEmail] } });
    await AcademicContext.deleteMany({ department: 'FWLT' });
    await Course.deleteMany({ courseCode: { $regex: '^FWLT' } });
    await Faculty.deleteMany({ facultyId: { $regex: '^FWL-TEST' } });
    await HODFacultyAllocation.deleteMany({ department: 'FWLT' });

    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const hodUser = await User.create({
      name: 'FWL Test HOD',
      email: hodEmail,
      passwordHash,
      role: 'HOD',
      facultyId: 'FWL-TEST-HOD',
      isActive: true,
    });
    const hodToken = generateToken(hodUser);

    const tcUser = await User.create({
      name: 'FWL Test TC',
      email: tcEmail,
      passwordHash,
      role: 'TC',
      facultyId: 'FWL-TEST-TC',
      isActive: true,
    });
    const tcToken = generateToken(tcUser);

    // Create Faculty Members
    const fac1 = await Faculty.create({
      facultyId: 'FWL-TEST-01',
      facultyName: 'Dr. Test One',
      department: 'Computer Science and Engineering',
      designation: 'Associate Professor',
      roles: ['FACULTY'],
      workload: { ugTheory: 0, ugLab: 0, pgSubject: 0 },
      isActive: true,
    });

    const fac2 = await Faculty.create({
      facultyId: 'FWL-TEST-02',
      facultyName: 'Dr. Test Two',
      department: 'Computer Science and Engineering',
      designation: 'Assistant Professor',
      roles: ['FACULTY'],
      workload: { ugTheory: 0, ugLab: 0, pgSubject: 0 },
      isActive: true,
    });

    // Create Academic Context
    const ctx = await AcademicContext.create({
      academicYear: '2026-27',
      fromYear: 2026,
      toYear: 2027,
      regulation: 'R22',
      semester: 'ODD',
      department: 'FWLT',
      year: 3,
      section: 'A',
      status: 'ACTIVE',
    });

    // Create Test Courses: 3 UG Theory, 3 UG Lab, 2 PG Courses with semester 'Semester V'
    const cTheory1 = await Course.create({ courseCode: 'FWLT301', courseName: 'Theory One', type: 'THEORY', credits: 3, totalPeriod: 3, semester: 'Semester V', regulation: 'R22', department: 'FWLT' });
    const cTheory2 = await Course.create({ courseCode: 'FWLT302', courseName: 'Theory Two', type: 'THEORY', credits: 3, totalPeriod: 3, semester: 'Semester V', regulation: 'R22', department: 'FWLT' });
    const cTheory3 = await Course.create({ courseCode: 'FWLT303', courseName: 'Theory Three', type: 'THEORY', credits: 3, totalPeriod: 3, semester: 'Semester V', regulation: 'R22', department: 'FWLT' });

    const cLab1 = await Course.create({ courseCode: 'FWLT311', courseName: 'Lab One', courseType: 'LAB', isLab: true, credits: 2, totalPeriod: 4, semester: 'Semester V', regulation: 'R22', department: 'FWLT' });
    const cLab2 = await Course.create({ courseCode: 'FWLT312', courseName: 'Lab Two', courseType: 'LAB', isLab: true, credits: 2, totalPeriod: 4, semester: 'Semester V', regulation: 'R22', department: 'FWLT' });
    const cLab3 = await Course.create({ courseCode: 'FWLT313', courseName: 'Lab Three', courseType: 'LAB', isLab: true, credits: 2, totalPeriod: 4, semester: 'Semester V', regulation: 'R22', department: 'FWLT' });

    const cPg1 = await Course.create({ courseCode: 'FWLT401', courseName: 'PG Advanced One', courseType: 'THEORY', category: 'PG', credits: 3, totalPeriod: 3, semester: 'Semester V', regulation: 'R22', isPgSubject: true, department: 'FWLT' });
    const cPg2 = await Course.create({ courseCode: 'FWLT402', courseName: 'PG Advanced Two', courseType: 'THEORY', category: 'PG', credits: 3, totalPeriod: 3, semester: 'Semester V', regulation: 'R22', isPgSubject: true, department: 'FWLT' });

    // ------------------------------------------------------------
    // TEST 1: UG Theory Workload Limit (Max 2, 3rd Rejected)
    // ------------------------------------------------------------
    console.log('\n--- 1. UG Theory Limit Enforcement ---');
    // Allocate 1st theory
    const allocT1 = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctx._id}/course/${cTheory1.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyId: fac1.facultyId,
      },
    });
    assert(allocT1.statusCode === 200, 'First UG Theory allocation succeeds (HTTP 200)');

    // Allocate 2nd theory
    const allocT2 = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctx._id}/course/${cTheory2.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyId: fac1.facultyId,
      },
    });
    assert(allocT2.statusCode === 200, 'Second UG Theory allocation succeeds (HTTP 200)');

    // Allocate 3rd theory -> must reject with THEORY_LOAD_LIMIT_EXCEEDED
    const allocT3 = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctx._id}/course/${cTheory3.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyId: fac1.facultyId,
      },
    });
    assert(allocT3.statusCode === 400, 'Third UG Theory allocation rejected (HTTP 400)');
    assert(allocT3.body && (allocT3.body.code === 'THEORY_LOAD_LIMIT_EXCEEDED' || allocT3.body.error?.code === 'THEORY_LOAD_LIMIT_EXCEEDED'), 'Error code is THEORY_LOAD_LIMIT_EXCEEDED');

    // ------------------------------------------------------------
    // TEST 2: UG Lab Workload Limit (Max 2, 3rd Rejected)
    // ------------------------------------------------------------
    console.log('\n--- 2. UG Lab Limit Enforcement ---');
    // Allocate 1st lab
    const allocL1 = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctx._id}/course/${cLab1.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyAssignments: [
          { facultyId: fac1.facultyId, role: 'PRIMARY' },
          { facultyId: fac2.facultyId, role: 'ADDITIONAL' },
        ],
      },
    });
    assert(allocL1.statusCode === 200, 'First UG Lab allocation succeeds (HTTP 200)');

    // Allocate 2nd lab
    const allocL2 = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctx._id}/course/${cLab2.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyAssignments: [
          { facultyId: fac1.facultyId, role: 'PRIMARY' },
          { facultyId: fac2.facultyId, role: 'ADDITIONAL' },
        ],
      },
    });
    assert(allocL2.statusCode === 200, 'Second UG Lab allocation succeeds (HTTP 200)');

    // Allocate 3rd lab -> must reject with LAB_LOAD_LIMIT_EXCEEDED
    const allocL3 = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctx._id}/course/${cLab3.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyAssignments: [
          { facultyId: fac1.facultyId, role: 'PRIMARY' },
          { facultyId: fac2.facultyId, role: 'ADDITIONAL' },
        ],
      },
    });
    assert(allocL3.statusCode === 400, 'Third UG Lab allocation rejected (HTTP 400)');
    assert(allocL3.body && (allocL3.body.code === 'LAB_LOAD_LIMIT_EXCEEDED' || allocL3.body.error?.code === 'LAB_LOAD_LIMIT_EXCEEDED'), 'Error code is LAB_LOAD_LIMIT_EXCEEDED');

    // ------------------------------------------------------------
    // TEST 3: PG / Honours Limit (Max 1, 2nd Rejected)
    // ------------------------------------------------------------
    console.log('\n--- 3. PG Subject Limit Enforcement ---');
    // Allocate 1st PG course
    const allocPg1 = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctx._id}/course/${cPg1.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyId: fac1.facultyId,
      },
    });
    assert(allocPg1.statusCode === 200, 'First PG subject allocation succeeds (HTTP 200)');

    // Allocate 2nd PG course -> must reject with PG_LOAD_LIMIT_EXCEEDED
    const allocPg2 = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/context/${ctx._id}/course/${cPg2.courseCode}`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        facultyId: fac1.facultyId,
      },
    });
    assert(allocPg2.statusCode === 400, 'Second PG subject allocation rejected (HTTP 400)');
    assert(allocPg2.body && (allocPg2.body.code === 'PG_LOAD_LIMIT_EXCEEDED' || allocPg2.body.error?.code === 'PG_LOAD_LIMIT_EXCEEDED'), 'Error code is PG_LOAD_LIMIT_EXCEEDED');

    // ------------------------------------------------------------
    // TEST 4: Faculty Creation Validator rejects teaching.pg > 1
    // ------------------------------------------------------------
    console.log('\n--- 4. Faculty Creation PG Limit Validation ---');
    const pgCreateErrors = validateFacultyCreationPayload({
      facultyName: 'Dr. Multi PG',
      designation: 'Professor',
      dateOfBirth: '1985-05-15',
      teaching: {
        pg: [
          { courseName: 'PG101', hours: 1 },
          { courseName: 'PG102', hours: 1 },
        ],
      },
    });
    assert(pgCreateErrors.length > 0, 'Payload with 2 PG subjects is rejected by validator');
    assert(pgCreateErrors.some((e) => e.includes('PG-level course handling allows a maximum of 1 subject')), 'Validator rejects 2nd PG subject');

    const pgSingleErrors = validateFacultyCreationPayload({
      facultyName: 'Dr. Single PG',
      designation: 'Professor',
      dateOfBirth: '1985-05-15',
      teaching: {
        pg: [{ courseName: 'PG101', hours: 1 }],
      },
    });
    assert(pgSingleErrors.length === 0, 'Payload with 1 PG subject is valid');

    // ------------------------------------------------------------
    // TEST 5: Other Academic Activities (1 to 3 hours/week)
    // ------------------------------------------------------------
    console.log('\n--- 5. Other Academic Activities Hours Range ---');
    const errsLow = validateTeachingPayload({ others: [{ courseName: 'Project', hours: 0 }] });
    assert(errsLow.some((e) => e.includes('between 1 and 3 hours/week')), '0 hours for others is rejected (< 1)');

    const errsHigh = validateTeachingPayload({ others: [{ courseName: 'Project', hours: 4 }] });
    assert(errsHigh.some((e) => e.includes('between 1 and 3 hours/week')), '4 hours for others is rejected (> 3)');

    const errsOk1 = validateTeachingPayload({ others: [{ courseName: 'Project', hours: 1 }] });
    assert(errsOk1.length === 0, '1 hour for others is accepted');

    const errsOk2 = validateTeachingPayload({ others: [{ courseName: 'Project', hours: 2 }] });
    assert(errsOk2.length === 0, '2 hours for others is accepted');

    const errsOk3 = validateTeachingPayload({ others: [{ courseName: 'Project', hours: 3 }] });
    assert(errsOk3.length === 0, '3 hours for others is accepted');

    // ------------------------------------------------------------
    // TEST 6: Institutional Responsibilities (1 to 6 hours/week)
    // ------------------------------------------------------------
    console.log('\n--- 6. Institutional Responsibility Hours Range ---');
    const respLow = validateResponsibilitiesPayload([{ role: 'Class Advisor', hours: 0 }]);
    assert(respLow.some((e) => e.includes('between 1 and 6 hours/week')), '0 hours for responsibility is rejected (< 1)');

    const respHigh = validateResponsibilitiesPayload([{ role: 'Class Advisor', hours: 7 }]);
    assert(respHigh.some((e) => e.includes('between 1 and 6 hours/week')), '7 hours for responsibility is rejected (> 6)');

    const respOk1 = validateResponsibilitiesPayload([{ role: 'Class Advisor', hours: 1 }]);
    assert(respOk1.length === 0, '1 hour for responsibility is accepted');

    const respOk6 = validateResponsibilitiesPayload([{ role: 'Class Advisor', hours: 6 }]);
    assert(respOk6.length === 0, '6 hours for responsibility is accepted');

    // ------------------------------------------------------------
    // TEST 7: Duplicate Institutional Responsibility Prevention
    // ------------------------------------------------------------
    console.log('\n--- 7. Duplicate Institutional Responsibility Prevention ---');
    const respDup = validateResponsibilitiesPayload([
      { role: 'Class Advisor', hours: 2 },
      { role: 'Class Advisor', hours: 3 },
    ]);
    assert(respDup.some((e) => e.includes('Duplicate responsibility')), 'Duplicate responsibility is rejected');

    // Verify 38 master roles are present in master list
    assert(Array.isArray(RESPONSIBILITY_MASTER_ROLES) && RESPONSIBILITY_MASTER_ROLES.length === 38, 'Institutional responsibility master contains exactly 38 roles');

  } finally {
    // Cleanup
    await User.deleteMany({ email: { $in: [hodEmail, tcEmail] } });
    await AcademicContext.deleteMany({ department: 'FWLT' });
    await Course.deleteMany({ courseCode: { $regex: '^FWLT' } });
    await Faculty.deleteMany({ facultyId: { $regex: '^FWL-TEST' } });
    await HODFacultyAllocation.deleteMany({ department: 'FWLT' });
    await disconnectDB();
  }

  console.log('\n============================================================');
  console.log(`FACULTY WORKLOAD RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in workload tests:', err);
  process.exit(1);
});
