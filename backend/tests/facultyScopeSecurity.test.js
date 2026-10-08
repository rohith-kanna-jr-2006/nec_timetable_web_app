/**
 * Faculty Data Scope Security Test Suite (B9)
 *
 * Requirements:
 * 1. Authenticated Faculty identity determines faculty scope.
 * 2. Faculty cannot manually modify API parameters to access another faculty's timetable.
 * 3. Faculty A requests Faculty B timetable -> HTTP 403 FORBIDDEN.
 * 4. Faculty A requests Faculty B allocations -> HTTP 403 FORBIDDEN.
 * 5. Faculty A requests own timetable -> HTTP 200.
 * 6. Faculty A requests own allocations -> HTTP 200.
 * 7. TC, HOD, ADMIN can access any faculty timetable for operational/review tasks.
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
const FacultyWorkload = require('../src/models/FacultyWorkload');
const TimetableVersion = require('../src/models/TimetableVersion');
const AcademicContext = require('../src/models/AcademicContext');
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
  console.log('FACULTY DATA SCOPE SECURITY TEST SUITE (B9)');
  console.log('============================================================\n');

  await connectDB();

  const TEST_PREFIX = 'FSCTEST_';
  const facAEmail = `${TEST_PREFIX}facA@nec.edu.in`;
  const facBEmail = `${TEST_PREFIX}facB@nec.edu.in`;
  const tcEmail = `${TEST_PREFIX}tc@nec.edu.in`;
  const hodEmail = `${TEST_PREFIX}hod@nec.edu.in`;
  const adminEmail = `${TEST_PREFIX}admin@nec.edu.in`;

  try {
    // Cleanup previous runs
    await User.deleteMany({ email: { $in: [facAEmail, facBEmail, tcEmail, hodEmail, adminEmail] } });
    await Faculty.deleteMany({ facultyId: { $in: ['FWL-SEC-A', 'FWL-SEC-B'] } });
    await FacultyWorkload.deleteMany({ facultyId: { $in: ['FWL-SEC-A', 'FWL-SEC-B'] } });

    const passwordHash = await bcrypt.hash('TestPass123!', 10);

    // Create Faculty A & B master docs
    await Faculty.create({
      facultyId: 'FWL-SEC-A',
      facultyName: 'Dr. Scope Alpha',
      email: facAEmail,
      department: 'Computer Science and Engineering',
      designation: 'Associate Professor',
      roles: ['FACULTY'],
      isActive: true,
    });
    await FacultyWorkload.create({
      facultyId: 'FWL-SEC-A',
      facultyName: 'Dr. Scope Alpha',
      department: 'Computer Science and Engineering',
      designation: 'Associate Professor',
    });

    await Faculty.create({
      facultyId: 'FWL-SEC-B',
      facultyName: 'Dr. Scope Beta',
      email: facBEmail,
      department: 'Computer Science and Engineering',
      designation: 'Assistant Professor',
      roles: ['FACULTY'],
      isActive: true,
    });
    await FacultyWorkload.create({
      facultyId: 'FWL-SEC-B',
      facultyName: 'Dr. Scope Beta',
      department: 'Computer Science and Engineering',
      designation: 'Assistant Professor',
    });

    // Create User accounts
    const userFacA = await User.create({
      name: 'Dr. Scope Alpha',
      email: facAEmail,
      passwordHash,
      role: 'FACULTY',
      facultyId: 'FWL-SEC-A',
      isActive: true,
    });
    const tokenFacA = generateToken(userFacA);

    const userFacB = await User.create({
      name: 'Dr. Scope Beta',
      email: facBEmail,
      passwordHash,
      role: 'FACULTY',
      facultyId: 'FWL-SEC-B',
      isActive: true,
    });
    const tokenFacB = generateToken(userFacB);

    const userTc = await User.create({
      name: 'Scope TC',
      email: tcEmail,
      passwordHash,
      role: 'TC',
      facultyId: 'FWL-SEC-TC',
      isActive: true,
    });
    const tokenTc = generateToken(userTc);

    const userHod = await User.create({
      name: 'Scope HOD',
      email: hodEmail,
      passwordHash,
      role: 'HOD',
      facultyId: 'FWL-SEC-HOD',
      isActive: true,
    });
    const tokenHod = generateToken(userHod);

    const userAdmin = await User.create({
      name: 'Scope Admin',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    });
    const tokenAdmin = generateToken(userAdmin);

    // ------------------------------------------------------------
    // TEST 1: Faculty A requests own timetable -> HTTP 200
    // ------------------------------------------------------------
    console.log('\n--- 1. Own Timetable Access ---');
    const ownTimetableRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/FWL-SEC-A',
      headers: { Authorization: `Bearer ${tokenFacA}` },
    });
    assert(ownTimetableRes.statusCode === 200, 'Faculty A requesting own timetable succeeds (HTTP 200)');
    assert(ownTimetableRes.body.success === true, 'Response body has success: true');

    // ------------------------------------------------------------
    // TEST 2: Faculty A requests Faculty B timetable -> HTTP 403 FORBIDDEN
    // ------------------------------------------------------------
    console.log('\n--- 2. Cross-Faculty Timetable Denial ---');
    const crossTimetableRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/FWL-SEC-B',
      headers: { Authorization: `Bearer ${tokenFacA}` },
    });
    assert(crossTimetableRes.statusCode === 403, 'Faculty A requesting Faculty B timetable is rejected with HTTP 403');
    assert(crossTimetableRes.body && crossTimetableRes.body.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // Case-insensitivity check (lowercase faculty ID in URL)
    const crossLowerTimetableRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/fwl-sec-b',
      headers: { Authorization: `Bearer ${tokenFacA}` },
    });
    assert(crossLowerTimetableRes.statusCode === 403, 'Cross-faculty access denied with lower-case param (HTTP 403)');

    // ------------------------------------------------------------
    // TEST 3: Faculty A requests own allocations -> HTTP 200
    // ------------------------------------------------------------
    console.log('\n--- 3. Own Allocations Access ---');
    const ownAllocRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/faculty/FWL-SEC-A/allocations',
      headers: { Authorization: `Bearer ${tokenFacA}` },
    });
    assert(ownAllocRes.statusCode === 200, 'Faculty A requesting own allocations succeeds (HTTP 200)');

    // ------------------------------------------------------------
    // TEST 4: Faculty A requests Faculty B allocations -> HTTP 403 FORBIDDEN
    // ------------------------------------------------------------
    console.log('\n--- 4. Cross-Faculty Allocations Denial ---');
    const crossAllocRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/faculty/FWL-SEC-B/allocations',
      headers: { Authorization: `Bearer ${tokenFacA}` },
    });
    assert(crossAllocRes.statusCode === 403, 'Faculty A requesting Faculty B allocations is rejected with HTTP 403');
    assert(crossAllocRes.body && crossAllocRes.body.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // ------------------------------------------------------------
    // TEST 5: Elevated Roles (TC, HOD, ADMIN) can access any faculty timetable
    // ------------------------------------------------------------
    console.log('\n--- 5. Elevated Roles Operational Access ---');
    const tcRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/FWL-SEC-A',
      headers: { Authorization: `Bearer ${tokenTc}` },
    });
    assert(tcRes.statusCode === 200, 'TC can access faculty timetable (HTTP 200)');

    const hodRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/FWL-SEC-A',
      headers: { Authorization: `Bearer ${tokenHod}` },
    });
    assert(hodRes.statusCode === 200, 'HOD can access faculty timetable (HTTP 200)');

    const adminRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/FWL-SEC-A',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(adminRes.statusCode === 200, 'ADMIN can access faculty timetable (HTTP 200)');

  } finally {
    // Cleanup
    await User.deleteMany({ email: { $in: [facAEmail, facBEmail, tcEmail, hodEmail, adminEmail] } });
    await Faculty.deleteMany({ facultyId: { $in: ['FWL-SEC-A', 'FWL-SEC-B'] } });
    await FacultyWorkload.deleteMany({ facultyId: { $in: ['FWL-SEC-A', 'FWL-SEC-B'] } });
    await disconnectDB();
  }

  console.log('\n============================================================');
  console.log(`FACULTY DATA SCOPE RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in faculty scope security tests:', err);
  process.exit(1);
});
