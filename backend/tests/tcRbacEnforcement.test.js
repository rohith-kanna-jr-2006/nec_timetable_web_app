/**
 * TC RBAC Enforcement Test Suite
 *
 * Validates the Phase 1 timetable governance role separation:
 *
 * TC (TimeTable Coordinator)
 *   PASS: create version, solve, generate, create session, delete session, submit
 *   FAIL (403): approve, reject, publish
 *
 * HOD
 *   FAIL (403): create version, solve, generate, create session, delete session
 *   PASS: approve, reject, publish
 *
 * ADMIN
 *   PASS: all operations (full override)
 *
 * FACULTY
 *   FAIL (403): all write operations
 *
 * JWT role field
 *   TC login JWT must contain role: TC
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const AcademicContext = require('../src/models/AcademicContext');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
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
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);

      const req = http.request(
        { hostname: '127.0.0.1', port, path, method, headers: reqHeaders },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            server.close();
            let parsedData;
            try { parsedData = JSON.parse(rawData); } catch (e) { parsedData = rawData; }
            resolve({ statusCode: res.statusCode, body: parsedData });
          });
        }
      );
      req.on('error', (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function run() {
  console.log('============================================================');
  console.log('TC RBAC ENFORCEMENT TEST SUITE (Phase 1)');
  console.log('============================================================\n');

  await connectDB();

  const hash = await bcrypt.hash('TestPass123!', 10);
  const TEST_EMAILS = {
    tc: 'rbac_tc@nec.edu.in',
    hod: 'rbac_hod@nec.edu.in',
    admin: 'rbac_admin@nec.edu.in',
    faculty: 'rbac_fac@nec.edu.in',
  };

  const testUsersData = [
    { name: 'RBAC TC', email: TEST_EMAILS.tc, passwordHash: hash, role: 'TC', isActive: true },
    { name: 'RBAC HOD', email: TEST_EMAILS.hod, passwordHash: hash, role: 'HOD', isActive: true },
    { name: 'RBAC Admin', email: TEST_EMAILS.admin, passwordHash: hash, role: 'ADMIN', isActive: true },
    { name: 'RBAC Faculty', email: TEST_EMAILS.faculty, passwordHash: hash, role: 'FACULTY', isActive: true },
  ];

  for (const u of testUsersData) {
    await User.findOneAndUpdate({ email: u.email }, { $set: u }, { upsert: true });
  }

  const tcUser = await User.findOne({ email: TEST_EMAILS.tc });
  const hodUser = await User.findOne({ email: TEST_EMAILS.hod });
  const adminUser = await User.findOne({ email: TEST_EMAILS.admin });
  const facUser = await User.findOne({ email: TEST_EMAILS.faculty });

  const tcToken = generateToken(tcUser);
  const hodToken = generateToken(hodUser);
  const adminToken = generateToken(adminUser);
  const facToken = generateToken(facUser);

  // Find a real academic context to use
  const ctx = await AcademicContext.findOne({ status: 'ACTIVE', department: 'CSE', year: 'II Year' });
  if (!ctx) {
    console.error('[Setup] No active CSE II Year context found. Run seed first.');
    process.exitCode = 1;
    await disconnectDB();
    return;
  }

  // --------------------------------------------------------------------------
  // TEST: JWT contains role: TC for TC login
  // --------------------------------------------------------------------------
  console.log('\n--- JWT Role Verification ---');
  const tcLoginRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/auth/login',
    body: { email: TEST_EMAILS.tc, password: 'TestPass123!' },
  });
  assert(tcLoginRes.statusCode === 200, 'TC login returns HTTP 200');
  const jwtRole = tcLoginRes.body.data && (tcLoginRes.body.data.role || (tcLoginRes.body.data.user && tcLoginRes.body.data.user.role));
  assert(jwtRole === 'TC', `JWT payload contains role: TC (got: ${jwtRole})`);

  // --------------------------------------------------------------------------
  // Create a test version for the TC (to use in HOD design-block tests)
  // --------------------------------------------------------------------------
  const tcVersionPayload = {
    academicYear: ctx.academicYear,
    semester: ctx.semester || 'Odd Semester',
    department: ctx.department,
    year: ctx.year,
    section: ctx.section,
    label: 'Phase1-RBAC-Test-Version',
  };

  console.log('\n--- TC CREATE VERSION ---');
  const tcCreateVersionRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/version',
    headers: { Authorization: `Bearer ${tcToken}` },
    body: tcVersionPayload,
  });
  assert(tcCreateVersionRes.statusCode === 201 || tcCreateVersionRes.statusCode === 200, `TC create version succeeds (HTTP ${tcCreateVersionRes.statusCode})`);
  const testVersionId = tcCreateVersionRes.body.data && tcCreateVersionRes.body.data._id;

  // --------------------------------------------------------------------------
  // HOD: Design Endpoints Must Return 403
  // --------------------------------------------------------------------------
  console.log('\n--- HOD Design Block Tests (all must return 403) ---');

  const hodCreateVersionRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/version',
    headers: { Authorization: `Bearer ${hodToken}` },
    body: tcVersionPayload,
  });
  assert(hodCreateVersionRes.statusCode === 403, `HOD create version → 403 (got: ${hodCreateVersionRes.statusCode})`);
  assert(hodCreateVersionRes.body.code === 'FORBIDDEN', `HOD create version error code = FORBIDDEN (got: ${hodCreateVersionRes.body.code})`);

  const hodSolveRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/solve',
    headers: { Authorization: `Bearer ${hodToken}` },
    body: { academicContextId: ctx._id },
  });
  assert(hodSolveRes.statusCode === 403, `HOD solve → 403 (got: ${hodSolveRes.statusCode})`);

  const hodGenerateRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/generate',
    headers: { Authorization: `Bearer ${hodToken}` },
    body: { academicContextId: ctx._id },
  });
  assert(hodGenerateRes.statusCode === 403, `HOD generate → 403 (got: ${hodGenerateRes.statusCode})`);

  const hodCreateSessionRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/session',
    headers: { Authorization: `Bearer ${hodToken}` },
    body: {
      timetableVersionId: testVersionId || '000000000000000000000001',
      academicContextId: ctx._id,
      courseCode: '22CSC06',
      facultyId: 'FWL-03',
      day: 'MON',
      period: 'P1',
      room: 'LH-101',
    },
  });
  assert(hodCreateSessionRes.statusCode === 403, `HOD create session → 403 (got: ${hodCreateSessionRes.statusCode})`);

  const hodDeleteSessionRes = await makeRequest(app, {
    method: 'DELETE',
    path: '/api/timetable/session/000000000000000000000001',
    headers: { Authorization: `Bearer ${hodToken}` },
  });
  assert(hodDeleteSessionRes.statusCode === 403, `HOD delete session → 403 (got: ${hodDeleteSessionRes.statusCode})`);

  // --------------------------------------------------------------------------
  // TC: Cannot Approve / Reject / Publish
  // --------------------------------------------------------------------------
  console.log('\n--- TC Approval-Block Tests (all must return 403) ---');

  if (testVersionId) {
    // Set version to PENDING_HOD_APPROVAL state directly for the approval tests
    await TimetableVersion.findByIdAndUpdate(testVersionId, { status: 'PENDING_HOD_APPROVAL' });

    const tcApproveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersionId}/status`,
      headers: { Authorization: `Bearer ${tcToken}` },
      body: { status: 'APPROVED' },
    });
    assert(tcApproveRes.statusCode === 403, `TC approve → 403 (got: ${tcApproveRes.statusCode})`);
    assert(tcApproveRes.body.code === 'STATE_TRANSITION_ERROR', `TC approve error code = STATE_TRANSITION_ERROR (got: ${tcApproveRes.body.code})`);

    const tcRejectRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersionId}/status`,
      headers: { Authorization: `Bearer ${tcToken}` },
      body: { status: 'REJECTED' },
    });
    assert(tcRejectRes.statusCode === 403, `TC reject → 403 (got: ${tcRejectRes.statusCode})`);

    // Set to APPROVED to test TC publish block
    await TimetableVersion.findByIdAndUpdate(testVersionId, { status: 'APPROVED' });

    const tcPublishRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersionId}/status`,
      headers: { Authorization: `Bearer ${tcToken}` },
      body: { status: 'PUBLISHED' },
    });
    assert(tcPublishRes.statusCode === 403, `TC publish → 403 (got: ${tcPublishRes.statusCode})`);
  } else {
    console.log('  (skipping approval tests — version creation failed)');
    failCount += 3;
  }

  // --------------------------------------------------------------------------
  // TC: Submit (GENERATED → PENDING_HOD_APPROVAL) — must PASS
  // --------------------------------------------------------------------------
  console.log('\n--- TC Submit Test (must PASS) ---');

  if (testVersionId) {
    // Phase 5: a version with zero sessions is not reviewable and must be
    // rejected before it can ever reach the HOD.
    await TimetableVersion.findByIdAndUpdate(testVersionId, { status: 'GENERATED' });
    const emptySubmitRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersionId}/status`,
      headers: { Authorization: `Bearer ${tcToken}` },
      body: { status: 'PENDING_HOD_APPROVAL' },
    });
    assert(emptySubmitRes.statusCode === 409, `TC submit of a zero-session version → 409 (got: ${emptySubmitRes.statusCode})`);
    assert(
      emptySubmitRes.body.error && emptySubmitRes.body.error.code === 'TIMETABLE_NOT_READY_FOR_SUBMISSION',
      `Zero-session submit error code = TIMETABLE_NOT_READY_FOR_SUBMISSION (got: ${emptySubmitRes.body.error && emptySubmitRes.body.error.code})`
    );

    // Give the version one HOD-approved session so the RBAC path (TC may
    // submit) is still exercised against a reviewable timetable.
    const hodAlloc = await HODFacultyAllocation.findOne({
      academicContextId: ctx._id,
      status: { $ne: 'REJECTED' },
      facultyId: { $exists: true, $ne: null },
    });
    if (hodAlloc) {
      const seedSessionRes = await makeRequest(app, {
        method: 'POST',
        path: '/api/timetable/session',
        headers: { Authorization: `Bearer ${tcToken}` },
        body: {
          timetableVersionId: testVersionId,
          academicContextId: ctx._id,
          courseCode: hodAlloc.courseCode,
          facultyId: hodAlloc.facultyId,
          day: 'SAT',
          period: 'P8',
          room: 'LH-101',
        },
      });
      assert(seedSessionRes.statusCode === 201, `Seed session created for the submit fixture (HTTP ${seedSessionRes.statusCode})`);
    } else {
      console.log('  (no HOD allocation available to seed a session)');
    }

    const tcSubmitRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersionId}/status`,
      headers: { Authorization: `Bearer ${tcToken}` },
      body: { status: 'PENDING_HOD_APPROVAL' },
    });
    assert(tcSubmitRes.statusCode === 200, `TC submit GENERATED → PENDING_HOD_APPROVAL → 200 (got: ${tcSubmitRes.statusCode})`);
    assert(tcSubmitRes.body.data && tcSubmitRes.body.data.status === 'PENDING_HOD_APPROVAL',
      `Version status is PENDING_HOD_APPROVAL after TC submit`);
  }

  // --------------------------------------------------------------------------
  // HOD: Approve — must PASS
  // --------------------------------------------------------------------------
  console.log('\n--- HOD Approval Tests (must PASS) ---');

  if (testVersionId) {
    const hodApproveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersionId}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'APPROVED' },
    });
    assert(hodApproveRes.statusCode === 200, `HOD approve → 200 (got: ${hodApproveRes.statusCode})`);

    const hodPublishRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${testVersionId}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'PUBLISHED' },
    });
    assert(hodPublishRes.statusCode === 200, `HOD publish → 200 (got: ${hodPublishRes.statusCode})`);
  }

  // HOD reject test (need a fresh pending version)
  const hodRejectVersion = await TimetableVersion.create({
    academicContextId: ctx._id,
    academicYear: ctx.academicYear,
    semester: ctx.semester || 'Odd Semester',
    department: ctx.department,
    year: ctx.year,
    section: ctx.section,
    label: 'Phase1-RBAC-Reject-Test',
    status: 'PENDING_HOD_APPROVAL',
  });

  const hodRejectRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/timetable/version/${hodRejectVersion._id}/status`,
    headers: { Authorization: `Bearer ${hodToken}` },
    body: { status: 'REJECTED', rejectionReason: 'Test rejection' },
  });
  assert(hodRejectRes.statusCode === 200, `HOD reject → 200 (got: ${hodRejectRes.statusCode})`);

  // --------------------------------------------------------------------------
  // FACULTY: All write endpoints must return 403
  // --------------------------------------------------------------------------
  console.log('\n--- FACULTY Block Tests (all must return 403) ---');

  const facVersionRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/version',
    headers: { Authorization: `Bearer ${facToken}` },
    body: tcVersionPayload,
  });
  assert(facVersionRes.statusCode === 403, `FACULTY create version → 403 (got: ${facVersionRes.statusCode})`);

  const facSessionRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/session',
    headers: { Authorization: `Bearer ${facToken}` },
    body: { courseCode: '22CSC06', facultyId: 'FWL-03', day: 'MON', period: 'P1' },
  });
  assert(facSessionRes.statusCode === 403, `FACULTY create session → 403 (got: ${facSessionRes.statusCode})`);

  // --------------------------------------------------------------------------
  // HOD cannot transition design targets
  // --------------------------------------------------------------------------
  console.log('\n--- HOD Design-Transition Block (must return 403) ---');

  const hodDesignVersion = await TimetableVersion.create({
    academicContextId: ctx._id,
    academicYear: ctx.academicYear,
    semester: ctx.semester || 'Odd Semester',
    department: ctx.department,
    year: ctx.year,
    section: ctx.section,
    label: 'Phase1-HOD-Design-Block',
    status: 'DRAFT',
  });

  const hodToDraftRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/timetable/version/${hodDesignVersion._id}/status`,
    headers: { Authorization: `Bearer ${hodToken}` },
    body: { status: 'GENERATED' },
  });
  assert(hodToDraftRes.statusCode === 403, `HOD → GENERATED from DRAFT → 403 (got: ${hodToDraftRes.statusCode})`);
  assert(hodToDraftRes.body.code === 'STATE_TRANSITION_ERROR',
    `HOD design-transition error code = STATE_TRANSITION_ERROR (got: ${hodToDraftRes.body.code})`);

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------
  await User.deleteMany({ email: { $in: Object.values(TEST_EMAILS) } });
  if (testVersionId) await TimetableVersion.findByIdAndDelete(testVersionId);
  await TimetableVersion.findByIdAndDelete(hodRejectVersion._id);
  await TimetableVersion.findByIdAndDelete(hodDesignVersion._id);

  console.log('\n============================================================');
  console.log(`TC RBAC ENFORCEMENT: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('============================================================\n');

  if (failCount > 0) process.exitCode = 1;

  await disconnectDB();
}

run().catch((err) => {
  console.error('[TC RBAC Test Error]:', err);
  process.exitCode = 1;
});

if (require.main === module) {
  // already running
}
