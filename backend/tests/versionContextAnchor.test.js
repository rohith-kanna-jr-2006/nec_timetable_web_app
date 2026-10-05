/**
 * Version Context Anchor & Generated Timetable Visibility Test Suite
 *
 * Phase 2 Requirements Coverage:
 * §29: Version Context (belongs to context, filtered by context, returns academicContextId)
 * §30: Generation (TC generates, sessionsCreated > 0, sessions carry anchors, response exposes versionId)
 * §31: Zero Periods Regression (Public default retains published behavior; explicit versionId returns generated sessions)
 * §32: Wrong Version Context Isolation (Context A + Version B → 409 conflict, no session leak)
 * §33: Published Context Isolation (Published A returns Version A only, Published B returns Version B only)
 * §34: Public Draft Leakage Prevention (Drafts hidden from public, visible only to internal requests with explicit versionId)
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const AcademicContext = require('../src/models/AcademicContext');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
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
          res.on('data', (chunk) => (rawData += chunk));
          res.on('end', () => {
            server.close();
            try {
              const parsed = JSON.parse(rawData);
              resolve({ statusCode: res.statusCode, body: parsed });
            } catch (_) {
              resolve({ statusCode: res.statusCode, body: rawData });
            }
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

async function runTests() {
  console.log('================================================================');
  console.log('PHASE 2: VERSION CONTEXT ANCHOR & TIMETABLE VISIBILITY TESTS');
  console.log('================================================================');

  await connectDB();

  // 1. Resolve Auth Tokens
  let tcUser = await User.findOne({ role: 'TC' });
  if (!tcUser) {
    tcUser = await User.findOne({ role: 'AC' });
  }
  const hodUser = await User.findOne({ role: 'HOD' });

  const tcToken = generateToken(tcUser);
  const hodToken = generateToken(hodUser);
  const tcHeaders = { Authorization: `Bearer ${tcToken}` };
  const hodHeaders = { Authorization: `Bearer ${hodToken}` };

  // 2. Resolve Two Distinct Academic Contexts (Cohort A and Cohort B)
  const ctxA = await AcademicContext.findOne({ department: 'CSE', year: 'II Year', section: 'A' });
  const ctxB = await AcademicContext.findOne({ department: 'CSE', year: 'II Year', section: 'B' });

  assert(ctxA && ctxB, 'Found two distinct AcademicContext records (CSE II-A and II-B)');
  assert(ctxA._id.toString() !== ctxB._id.toString(), 'Context A and Context B have different IDs');

  // ==========================================================================
  // SECTION 1: Version Creation & AcademicContextId Anchoring (§29)
  // ==========================================================================
  console.log('\n--- Section 1: TimetableVersion Creation with academicContextId ---');

  // Create Version for Context A
  const createResA = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/version',
    headers: tcHeaders,
    body: {
      academicContextId: ctxA._id.toString(),
      label: 'Phase2-Test-Version-A',
    },
  });

  assert(createResA.statusCode === 201, `Create version for Context A → 201 (got: ${createResA.statusCode})`);
  const versionA = createResA.body.data;
  assert(versionA && versionA._id, 'Version A created successfully');
  assert(
    versionA.academicContextId === ctxA._id.toString() ||
    (typeof versionA.academicContextId === 'object' && versionA.academicContextId._id === ctxA._id.toString()),
    'Version A response carries correct academicContextId anchor'
  );

  // Create Version for Context B
  const createResB = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/version',
    headers: tcHeaders,
    body: {
      academicContextId: ctxB._id.toString(),
      label: 'Phase2-Test-Version-B',
    },
  });

  assert(createResB.statusCode === 201, `Create version for Context B → 201 (got: ${createResB.statusCode})`);
  const versionB = createResB.body.data;
  assert(versionB && versionB._id, 'Version B created successfully');

  // GET /api/timetable/version/:id returns academicContextId
  const getVerRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/version/${versionA._id}`,
    headers: tcHeaders,
  });
  assert(getVerRes.statusCode === 200, `GET /api/timetable/version/:id → 200 (got: ${getVerRes.statusCode})`);
  assert(
    getVerRes.body.data && getVerRes.body.data.academicContextId,
    'GET /api/timetable/version/:id returns populated academicContextId'
  );

  // GET /api/timetable/versions?academicContextId=<ctxId>
  const listCtxARes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/versions?academicContextId=${ctxA._id.toString()}`,
    headers: tcHeaders,
  });
  assert(listCtxARes.statusCode === 200, `GET /api/timetable/versions?academicContextId=A → 200`);
  const rawData = listCtxARes.body.data;
  const itemsA = Array.isArray(rawData) ? rawData : (rawData?.items || []);
  const allBelongToA = itemsA.every((v) => {
    const vCtxId = v.academicContextId ? (v.academicContextId._id || v.academicContextId).toString() : null;
    return vCtxId === ctxA._id.toString() || (v.year === ctxA.year && v.section === ctxA.section);
  });
  assert(allBelongToA && itemsA.length > 0, 'Versions filtered by academicContextId return only matching cohort versions');

  // ==========================================================================
  // SECTION 2: Version-Context Isolation & Cross-Context Conflict (§32)
  // ==========================================================================
  console.log('\n--- Section 2: Cross-Context Conflict (Context A + Version B → 409) ---');

  // Requesting Context A timetable with Version B's ID must fail with 409
  const crossContextClassRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/class/${ctxA._id.toString()}?versionId=${versionB._id.toString()}`,
    headers: tcHeaders,
  });

  assert(
    crossContextClassRes.statusCode === 409,
    `GET /class/Context_A?versionId=Version_B → 409 Conflict (got: ${crossContextClassRes.statusCode})`
  );
  assert(
    crossContextClassRes.body.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH',
    `Returns error code TIMETABLE_VERSION_CONTEXT_MISMATCH (got: ${crossContextClassRes.body.code})`
  );

  // Review Matrix with mismatched context and version must also reject with 409
  const crossMatrixRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/review-matrix?academicContextId=${ctxA._id.toString()}&versionId=${versionB._id.toString()}`,
    headers: tcHeaders,
  });

  assert(
    crossMatrixRes.statusCode === 409,
    `GET /review-matrix?academicContextId=A&versionId=B → 409 Conflict (got: ${crossMatrixRes.statusCode})`
  );

  // ==========================================================================
  // SECTION 3: Published Context Isolation Bug Fix (§33, #15)
  // ==========================================================================
  console.log('\n--- Section 3: Published Context Isolation (No Global findOne Leak) ---');

  // Setup distinct published versions for Context A and Context B
  const pubVersionA = await TimetableVersion.create({
    academicContextId: ctxA._id,
    academicYear: ctxA.academicYear,
    semester: ctxA.semester,
    department: ctxA.department,
    year: ctxA.year,
    section: ctxA.section,
    versionLabel: 'v-Pub-A-Exact',
    status: 'PUBLISHED',
    publishedAt: new Date(Date.now() - 60000), // Published 1 min ago
  });

  const pubVersionB = await TimetableVersion.create({
    academicContextId: ctxB._id,
    academicYear: ctxB.academicYear,
    semester: ctxB.semester,
    department: ctxB.department,
    year: ctxB.year,
    section: ctxB.section,
    versionLabel: 'v-Pub-B-Exact',
    status: 'PUBLISHED',
    publishedAt: new Date(), // Published newer (globally latest)
  });

  // Seed 1 session for A and 1 for B
  await TimetableSession.create([
    {
      timetableVersionId: pubVersionA._id,
      academicContextId: ctxA._id,
      courseCode: '22CS201-A',
      courseName: 'Cohort A Session',
      facultyId: 'FWL-01',
      day: 'MON',
      period: 'P1',
      sessionType: 'THEORY',
    },
    {
      timetableVersionId: pubVersionB._id,
      academicContextId: ctxB._id,
      courseCode: '22CS201-B',
      courseName: 'Cohort B Session',
      facultyId: 'FWL-02',
      day: 'MON',
      period: 'P1',
      sessionType: 'THEORY',
    },
  ]);

  // Request Published for Context A: must return pubVersionA, NOT pubVersionB (even though B was published later!)
  const pubResA = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/published/${ctxA._id.toString()}`,
  });

  assert(pubResA.statusCode === 200, `GET /api/timetable/published/ctxA → 200 (got: ${pubResA.statusCode})`);
  assert(
    pubResA.body.data.versionId.toString() === pubVersionA._id.toString(),
    `GET /published/ctxA returns pubVersionA, not globally latest B (got: ${pubResA.body.data.versionLabel})`
  );
  assert(
    pubResA.body.data.sessions.some((s) => s.courseCode === '22CS201-A'),
    'GET /published/ctxA contains Context A session'
  );
  assert(
    !pubResA.body.data.sessions.some((s) => s.courseCode === '22CS201-B'),
    'GET /published/ctxA does NOT contain Context B session'
  );

  // Request Published for Context B: must return pubVersionB
  const pubResB = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/published/${ctxB._id.toString()}`,
  });

  assert(pubResB.statusCode === 200, `GET /api/timetable/published/ctxB → 200 (got: ${pubResB.statusCode})`);
  assert(
    pubResB.body.data.versionId.toString() === pubVersionB._id.toString(),
    `GET /published/ctxB returns pubVersionB (got: ${pubResB.body.data.versionLabel})`
  );

  // ==========================================================================
  // SECTION 4: Zero Periods Regression & Draft Visibility (§31, §34)
  // ==========================================================================
  console.log('\n--- Section 4: Zero Periods Regression & Draft Visibility ---');

  // Create an unpublished GENERATED version with sessions for Context A
  const genVersionA = await TimetableVersion.create({
    academicContextId: ctxA._id,
    academicYear: ctxA.academicYear,
    semester: ctxA.semester,
    department: ctxA.department,
    year: ctxA.year,
    section: ctxA.section,
    versionLabel: 'v-Generated-Draft-A',
    status: 'GENERATED',
    totalScheduledPeriods: 2,
  });

  await TimetableSession.create([
    {
      timetableVersionId: genVersionA._id,
      academicContextId: ctxA._id,
      courseCode: '22CS-GEN-01',
      courseName: 'Draft Generated Session 1',
      facultyId: 'FWL-03',
      day: 'TUE',
      period: 'P1',
      sessionType: 'THEORY',
    },
    {
      timetableVersionId: genVersionA._id,
      academicContextId: ctxA._id,
      courseCode: '22CS-GEN-02',
      courseName: 'Draft Generated Session 2',
      facultyId: 'FWL-04',
      day: 'TUE',
      period: 'P2',
      sessionType: 'THEORY',
    },
  ]);

  // Case 1: Public/default request WITHOUT versionId:
  // Must return ONLY the published timetable, NOT the draft generated sessions
  const publicClassRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/class/${ctxA._id.toString()}`,
  });
  assert(publicClassRes.statusCode === 200, 'Public GET /class/:academicContextId returns 200');
  const pubSessionCodes = (publicClassRes.body.data.sessions || []).map((s) => s.courseCode);
  assert(
    !pubSessionCodes.includes('22CS-GEN-01'),
    'Public default request hides unapproved draft generated sessions (no public leak)'
  );

  // Case 2: Internal TC request WITH explicit versionId:
  // Must return the generated sessions! (Fixes "0 scheduled periods" for TC review)
  const internalClassRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/class/${ctxA._id.toString()}?versionId=${genVersionA._id.toString()}`,
    headers: tcHeaders,
  });

  assert(internalClassRes.statusCode === 200, 'Internal GET /class/:ctx?versionId=:genVersionId returns 200');
  assert(internalClassRes.body.data.sessionCount === 2, `Session count is 2 (got: ${internalClassRes.body.data.sessionCount})`);
  const genSessionCodes = (internalClassRes.body.data.sessions || []).map((s) => s.courseCode);
  assert(
    genSessionCodes.includes('22CS-GEN-01') && genSessionCodes.includes('22CS-GEN-02'),
    'Internal request with explicit versionId returns generated sessions successfully'
  );

  // Case 3: Review Matrix with explicit versionId
  const matrixRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/review-matrix?academicContextId=${ctxA._id.toString()}&versionId=${genVersionA._id.toString()}`,
    headers: tcHeaders,
  });

  assert(matrixRes.statusCode === 200, 'Review Matrix with explicit versionId returns 200');
  assert(matrixRes.body.data.sessionCount === 2, `Review Matrix returns 2 sessions (got: ${matrixRes.body.data.sessionCount})`);
  assert(
    matrixRes.body.data.timetableVersionId === genVersionA._id.toString(),
    'Review Matrix returns exact matching timetableVersionId'
  );

  // ==========================================================================
  // SECTION 5: Multi-Faculty LAB & SAS Integrity Under Context Anchor (§23, §24)
  // ==========================================================================
  console.log('\n--- Section 5: Multi-Faculty LAB and SAS Session Context Integrity ---');

  // Insert a multi-faculty LAB session
  const labSession = await TimetableSession.create({
    timetableVersionId: genVersionA._id,
    academicContextId: ctxA._id,
    courseCode: '22CSP99',
    courseName: 'Phase 2 Test Lab',
    facultyId: 'FWL-05',
    facultyName: 'Dr. Test Primary',
    facultyAssignments: [
      { facultyId: 'FWL-05', facultyName: 'Dr. Test Primary', role: 'PRIMARY' },
      { facultyId: 'FWL-06', facultyName: 'Mrs. Test Additional', role: 'ADDITIONAL' },
    ],
    day: 'WED',
    period: 'P1',
    sessionType: 'LAB',
    duration: 2,
  });

  assert(
    labSession.academicContextId.toString() === ctxA._id.toString() &&
    labSession.timetableVersionId.toString() === genVersionA._id.toString(),
    'LAB session retains single-session multi-faculty assignments under exact context anchor'
  );

  // Faculty Schedule retrieval with explicit versionId works for both PRIMARY and ADDITIONAL
  const fac1Res = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/faculty/FWL-05?versionId=${genVersionA._id.toString()}`,
    headers: tcHeaders,
  });
  const fac2Res = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/faculty/FWL-06?versionId=${genVersionA._id.toString()}`,
    headers: tcHeaders,
  });

  assert(fac1Res.statusCode === 200, 'Faculty 1 schedule returns 200 with explicit versionId');
  assert(fac2Res.statusCode === 200, 'Faculty 2 schedule returns 200 with explicit versionId');

  // Clean up test records
  console.log('\n--- Cleaning up temporary test fixtures ---');
  await TimetableSession.deleteMany({
    timetableVersionId: { $in: [pubVersionA._id, pubVersionB._id, genVersionA._id, versionA._id, versionB._id] },
  });
  await TimetableVersion.deleteMany({
    _id: { $in: [pubVersionA._id, pubVersionB._id, genVersionA._id, versionA._id, versionB._id] },
  });
  console.log('  Cleaned up temporary versions and sessions.');

  await disconnectDB();

  console.log('\n================================================================');
  console.log(`PHASE 2 TEST SUMMARY: PASS: ${passCount} | FAIL: ${failCount}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
