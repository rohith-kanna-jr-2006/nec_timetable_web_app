/**
 * HOD Timetable Approval / Rejection / Publication Test Suite (Phase 6)
 *
 * Exercises the HOD governance lifecycle for an exact TimetableVersion inside
 * an exact AcademicContext:
 *
 *   GENERATED -> PENDING_HOD_APPROVAL -> APPROVED -> PUBLISHED
 *                            \-> REJECTED
 *
 * §12 A  Authentication      — unauthenticated approve/reject/publish -> 401
 * §12 B  RBAC                — FACULTY/TC blocked, HOD allowed, ADMIN per policy
 * §12 C  Status transitions  — exact valid/invalid edges
 * §12 D  Context integrity   — cross-context approve/reject/publish refused
 * §12 E  Rejection workflow  — rejected stays historical, revision needs a new version
 * §12 F  Publication        — only the published version is publicly visible
 * §12 G  Multi-faculty       — LAB/SAS facultyAssignments survive the lifecycle
 * §12 H  Immutability       — sessions frozen from submission onwards
 * §12 I  Cross-context leak — public reads never cross contexts
 *
 * Fixture policy (§12): this suite creates and fully owns its AcademicContext,
 * versions and sessions, and deletes only those. It never runs deleteMany()
 * against a seeded context.
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

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

const STATUS_PATH = '/api/timetable/version';
const GENERATE_PATH = '/api/timetable/generate-from-context';

const TEST_USERS = {
  hod: 'p6_hod@nec.edu.in',
  tc: 'p6_tc@nec.edu.in',
  faculty: 'p6_faculty@nec.edu.in',
  admin: 'p6_admin@nec.edu.in',
};

// Deterministic course codes / faculty so multi-faculty assertions are stable.
const LAB_3 = '22P6LAB1'; // PRIMARY + ADDITIONAL + OPTIONAL
const SAS_1 = '22P6SAS1'; // MATHS_BME + ENGLISH
const LAB_2 = '22P6LAB2'; // PRIMARY + ADDITIONAL
const THEORY_1 = '22P6THR1'; // single instructor

const FAC_A = 'P6-FAC-A';
const FAC_B = 'P6-FAC-B';
const FAC_C = 'P6-FAC-C';
const FAC_MATHS = 'P6-MATHS';
const FAC_ENG = 'P6-ENG';

let passCount = 0;
let failCount = 0;
let skipCount = 0;

// Every document this suite creates, for a deterministic teardown.
const owned = {
  contextIds: [],
  versionIds: [],
  userEmails: [],
  courseCodes: [],
};

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  PASS: ${message}`);
  } else {
    failCount++;
    console.error(`  FAIL: ${message}`);
  }
}

function skip(message) {
  skipCount++;
  console.log(`  SKIP: ${message}`);
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
              resolve({ statusCode: res.statusCode, body: JSON.parse(rawData) });
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

/** PATCHes a version status and returns the raw HTTP result. */
function transition(app_, versionId, status, headers, extra = {}) {
  return makeRequest(app_, {
    method: 'PATCH',
    path: `${STATUS_PATH}/${versionId}/status`,
    headers,
    body: { status, ...extra },
  });
}

/** Removes only documents this suite created. */
async function teardown() {
  if (mongoose.connection.readyState !== 1) return;
  for (const versionId of owned.versionIds) {
    await TimetableSession.deleteMany({ timetableVersionId: versionId });
    await TimetableVersion.findByIdAndDelete(versionId);
  }
  for (const contextId of owned.contextIds) {
    await HODFacultyAllocation.deleteMany({ academicContextId: contextId });
    await TimetableSession.deleteMany({ academicContextId: contextId });
    await TimetableVersion.deleteMany({ academicContextId: contextId });
    await AcademicContext.findByIdAndDelete(contextId);
  }
  if (owned.userEmails.length) {
    await User.deleteMany({ email: { $in: owned.userEmails } });
  }
}

// ---------------------------------------------------------------------------
// Fixture construction — everything below is owned and removed by teardown()
// ---------------------------------------------------------------------------

/**
 * Creates a dedicated AcademicContext. Phase 6 tests must never borrow (or
 * mutate) a seeded cohort, so each scenario owns its own context row.
 */
async function createOwnedContext(label) {
  const ctx = await AcademicContext.create({
    academicYear: '2026-27',
    semester: 'Odd Semester',
    department: 'CSE',
    year: 'III Year',
    section: label,
    program: 'UG',
    status: 'ACTIVE',
  });
  owned.contextIds.push(ctx._id);
  return ctx;
}

/** Creates a version owned by this suite and registers it for teardown. */
async function createOwnedVersion(context, status, label) {
  const version = await TimetableVersion.create({
    academicContextId: context._id,
    academicYear: context.academicYear,
    semester: context.semester,
    department: context.department,
    year: context.year,
    section: context.section,
    version: 1,
    versionLabel: label,
    status,
  });
  owned.versionIds.push(version._id);
  return version;
}

/**
 * Writes one TimetableSession per period, carrying the full instructor set,
 * mirroring exactly how the generation engine persists a multi-faculty slot.
 */
async function createBlock(version, context, opts) {
  const { courseCode, facultyId, facultyAssignments, day, periods, sessionType } = opts;
  const created = [];
  for (const period of periods) {
    const s = await TimetableSession.create({
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode,
      courseName: courseCode,
      facultyId,
      facultyName: (facultyAssignments[0] && facultyAssignments[0].facultyName) || '',
      facultyAssignments,
      day,
      period,
      room: 'P6 Lab',
      sessionType,
      duration: 1,
    });
    created.push(s);
  }
  return created;
}

/** Creates a version populated with a 3-faculty LAB, an MC_SAS, a 2-faculty LAB and theory. */
async function createMultiFacultyVersion(context, label, status = 'GENERATED') {
  const version = await createOwnedVersion(context, status, label);

  await createBlock(version, context, {
    courseCode: LAB_3,
    facultyId: FAC_A,
    facultyAssignments: [
      { facultyId: FAC_A, facultyName: 'P6 Faculty A', role: 'PRIMARY' },
      { facultyId: FAC_B, facultyName: 'P6 Faculty B', role: 'ADDITIONAL' },
      { facultyId: FAC_C, facultyName: 'P6 Faculty C', role: 'OPTIONAL' },
    ],
    day: 'MON',
    periods: ['P1', 'P2', 'P3', 'P4'],
    sessionType: 'LAB',
  });

  await createBlock(version, context, {
    courseCode: SAS_1,
    facultyId: FAC_MATHS,
    facultyAssignments: [
      { facultyId: FAC_MATHS, facultyName: 'P6 Maths', role: 'MATHS_BME' },
      { facultyId: FAC_ENG, facultyName: 'P6 English', role: 'ENGLISH' },
    ],
    day: 'TUE',
    periods: ['P1', 'P2', 'P3'],
    sessionType: 'SAS',
  });

  await createBlock(version, context, {
    courseCode: LAB_2,
    facultyId: FAC_A,
    facultyAssignments: [
      { facultyId: FAC_A, facultyName: 'P6 Faculty A', role: 'PRIMARY' },
      { facultyId: FAC_B, facultyName: 'P6 Faculty B', role: 'ADDITIONAL' },
    ],
    day: 'WED',
    periods: ['P1', 'P2', 'P3', 'P4'],
    sessionType: 'LAB',
  });

  await createBlock(version, context, {
    courseCode: THEORY_1,
    facultyId: FAC_A,
    facultyAssignments: [{ facultyId: FAC_A, facultyName: 'P6 Faculty A', role: 'THEORY' }],
    day: 'THU',
    periods: ['P1', 'P2', 'P3'],
    sessionType: 'THEORY',
  });

  await TimetableVersion.findByIdAndUpdate(version._id, {
    totalScheduledPeriods: 14,
    generatedBy: 'P6 Coordinator',
  });

  return version;
}

/** Advances a GENERATED version to PENDING_HOD_APPROVAL as the owning TC. */
async function submitForApproval(app_, version, context, tcHeaders) {
  return transition(app_, version._id, 'PENDING_HOD_APPROVAL', tcHeaders, {
    academicContextId: context._id.toString(),
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 6: HOD TIMETABLE APPROVAL / REJECTION / PUBLICATION');
  console.log('===============================================================\n');

  await connectDB();

  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const userSpecs = [
    { name: 'P6 HOD', email: TEST_USERS.hod, role: 'HOD' },
    { name: 'P6 TC', email: TEST_USERS.tc, role: 'TC' },
    { name: 'P6 Faculty', email: TEST_USERS.faculty, role: 'FACULTY' },
    { name: 'P6 Admin', email: TEST_USERS.admin, role: 'ADMIN' },
  ];
  for (const u of userSpecs) {
    await User.findOneAndUpdate(
      { email: u.email },
      { $set: { ...u, passwordHash, isActive: true } },
      { upsert: true }
    );
    owned.userEmails.push(u.email);
  }

  const hodUser = await User.findOne({ email: TEST_USERS.hod });
  const tcUser = await User.findOne({ email: TEST_USERS.tc });
  const facultyUser = await User.findOne({ email: TEST_USERS.faculty });
  const adminUser = await User.findOne({ email: TEST_USERS.admin });

  const hodHeaders = { Authorization: `Bearer ${generateToken(hodUser)}` };
  const tcHeaders = { Authorization: `Bearer ${generateToken(tcUser)}` };
  const facultyHeaders = { Authorization: `Bearer ${generateToken(facultyUser)}` };
  const adminHeaders = { Authorization: `Bearer ${generateToken(adminUser)}` };

  const codeOf = (res) =>
    (res.body && (res.body.code || (res.body.error && res.body.error.code))) || null;

  const readSessions = async (contextId, versionId) => {
    const res = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${contextId}?versionId=${versionId}`,
      headers: hodHeaders,
    });
    return res.body?.data?.sessions || [];
  };

  const govCases = [
    ['approval', 'APPROVED'],
    ['rejection', 'REJECTED'],
    ['publication', 'PUBLISHED'],
  ];

  console.log('\n-- Section A: Authentication -------------------------------');

  const ctxA = await createOwnedContext('P6A');
  const authVersion = await createMultiFacultyVersion(ctxA, 'P6-Auth');
  await submitForApproval(app, authVersion, ctxA, tcHeaders);

  for (const [label, status] of govCases) {
    const res = await transition(app, authVersion._id, status, {});
    assert(res.statusCode === 401, `Unauthenticated ${label} -> 401 (got: ${res.statusCode})`);
  }

  console.log('\n-- Section B: Role-Based Access Control ---------------------');

  const rbacCtx = await createOwnedContext('P6B');
  const rbacVersion = await createMultiFacultyVersion(rbacCtx, 'P6-RBAC');
  await submitForApproval(app, rbacVersion, rbacCtx, tcHeaders);

  for (const [label, status] of govCases) {
    const fac = await transition(app, rbacVersion._id, status, facultyHeaders);
    assert(fac.statusCode === 403, `FACULTY ${label} -> 403 (got: ${fac.statusCode})`);
    const tc = await transition(app, rbacVersion._id, status, tcHeaders);
    assert(tc.statusCode === 403, `TC ${label} -> 403 (got: ${tc.statusCode})`);
    assert(codeOf(tc) === 'STATE_TRANSITION_ERROR', `TC ${label} code = STATE_TRANSITION_ERROR`);
  }

  const rbacAfter = await TimetableVersion.findById(rbacVersion._id).lean();
  assert(
    rbacAfter.status === 'PENDING_HOD_APPROVAL',
    'Blocked TC/FACULTY attempts left the version untouched'
  );

  const hodApprove = await transition(app, rbacVersion._id, 'APPROVED', hodHeaders);
  assert(hodApprove.statusCode === 200, `HOD approval -> 200 (got: ${hodApprove.statusCode})`);
  const adminPublish = await transition(app, rbacVersion._id, 'PUBLISHED', adminHeaders);
  assert(adminPublish.statusCode === 200, `ADMIN publication -> 200 (got: ${adminPublish.statusCode})`);

  const rejCtx = await createOwnedContext('P6Brej');
  const rejVersion = await createMultiFacultyVersion(rejCtx, 'P6-HOD-Reject');
  await submitForApproval(app, rejVersion, rejCtx, tcHeaders);
  const hodReject = await transition(app, rejVersion._id, 'REJECTED', hodHeaders, {
    rejectionReason: 'Conflicting LAB block',
  });
  assert(hodReject.statusCode === 200, `HOD rejection -> 200 (got: ${hodReject.statusCode})`);

  console.log('\n-- Section C: Status Transitions ----------------------------');

  const genCtx = await createOwnedContext('P6C');
  const genVersion = await createMultiFacultyVersion(genCtx, 'P6-Transitions');

  let r = await transition(app, genVersion._id, 'APPROVED', hodHeaders);
  assert(r.statusCode === 409, `GENERATED -> APPROVED rejected (HTTP ${r.statusCode})`);
  assert(codeOf(r) === 'INVALID_TIMETABLE_STATUS_TRANSITION', 'Skipped transition is a structured 409');

  r = await transition(app, genVersion._id, 'PUBLISHED', hodHeaders);
  assert(r.statusCode === 409, `GENERATED -> PUBLISHED rejected (HTTP ${r.statusCode})`);

  const submitted = await submitForApproval(app, genVersion, genCtx, tcHeaders);
  assert(
    submitted.statusCode === 200,
    `GENERATED -> PENDING_HOD_APPROVAL -> 200 (got: ${submitted.statusCode})`
  );

  r = await transition(app, genVersion._id, 'PUBLISHED', hodHeaders);
  assert(r.statusCode === 409, `PENDING_HOD_APPROVAL -> PUBLISHED rejected (HTTP ${r.statusCode})`);

  r = await transition(app, genVersion._id, 'APPROVED', hodHeaders);
  assert(r.statusCode === 200, `PENDING_HOD_APPROVAL -> APPROVED -> 200 (got: ${r.statusCode})`);

  r = await transition(app, genVersion._id, 'PUBLISHED', hodHeaders);
  assert(r.statusCode === 200, `APPROVED -> PUBLISHED -> 200 (got: ${r.statusCode})`);

  // A PUBLISHED version has no outgoing edges. Probe with callers who are
  // ALLOWED to target each status, so the state machine alone decides.
  for (const status of ['APPROVED', 'REJECTED']) {
    r = await transition(app, genVersion._id, status, hodHeaders);
    assert(r.statusCode === 409, `PUBLISHED -> ${status} rejected (HTTP ${r.statusCode})`);
    assert(
      codeOf(r) === 'INVALID_TIMETABLE_STATUS_TRANSITION',
      `PUBLISHED -> ${status} reported as an invalid transition`
    );
  }
  for (const status of ['GENERATED', 'DRAFT']) {
    r = await transition(app, genVersion._id, status, tcHeaders);
    assert(
      r.statusCode === 409 && codeOf(r) === 'INVALID_TIMETABLE_STATUS_TRANSITION',
      `PUBLISHED -> ${status} rejected for an authorized TC (HTTP ${r.statusCode})`
    );
  }

  // Role precedence: an HOD may never reach a design-only target, so this is an
  // authority failure (403) rather than a statement about the edge (409).
  const hodToDesign = await transition(app, genVersion._id, 'GENERATED', hodHeaders);
  assert(
    hodToDesign.statusCode === 403 && codeOf(hodToDesign) === 'STATE_TRANSITION_ERROR',
    `HOD targeting a design-only status -> 403 (got: ${hodToDesign.statusCode})`
  );

  const rejOnlyCtx = await createOwnedContext('P6RejOnly');
  const rejOnlyVersion = await createMultiFacultyVersion(rejOnlyCtx, 'P6-Rejected-Only');
  await submitForApproval(app, rejOnlyVersion, rejOnlyCtx, tcHeaders);
  await transition(app, rejOnlyVersion._id, 'REJECTED', hodHeaders, {
    rejectionReason: 'Needs revision',
  });

  r = await transition(app, rejOnlyVersion._id, 'APPROVED', hodHeaders);
  assert(r.statusCode === 409, `REJECTED -> APPROVED rejected (HTTP ${r.statusCode})`);
  r = await transition(app, rejOnlyVersion._id, 'PUBLISHED', hodHeaders);
  assert(r.statusCode === 409, `REJECTED -> PUBLISHED rejected (HTTP ${r.statusCode})`);

  console.log('\n-- Section D: Context Integrity -----------------------------');

  const ctxX = await createOwnedContext('P6X');
  const ctxY = await createOwnedContext('P6Y');
  const xVersion = await createMultiFacultyVersion(ctxX, 'P6-X');
  await submitForApproval(app, xVersion, ctxX, tcHeaders);

  r = await transition(app, xVersion._id, 'APPROVED', hodHeaders, {
    academicContextId: ctxY._id.toString(),
  });
  assert(r.statusCode === 409, `Cross-context approval -> 409 (got: ${r.statusCode})`);
  assert(
    codeOf(r) === 'TIMETABLE_VERSION_CONTEXT_MISMATCH',
    'Cross-context approval uses the structured mismatch code'
  );

  r = await transition(app, xVersion._id, 'REJECTED', hodHeaders, {
    academicContextId: ctxY._id.toString(),
  });
  assert(r.statusCode === 409, `Cross-context rejection -> 409 (got: ${r.statusCode})`);

  const approveX = await transition(app, xVersion._id, 'APPROVED', hodHeaders, {
    academicContextId: ctxX._id.toString(),
  });
  assert(approveX.statusCode === 200, 'Approving with the correct context succeeds');

  r = await transition(app, xVersion._id, 'PUBLISHED', hodHeaders, {
    academicContextId: ctxY._id.toString(),
  });
  assert(r.statusCode === 409, `Cross-context publication -> 409 (got: ${r.statusCode})`);

  const stillApproved = await TimetableVersion.findById(xVersion._id).lean();
  assert(stillApproved.status === 'APPROVED', 'Cross-context publication left the version at APPROVED');
  assert(
    stillApproved.academicContextId.toString() === ctxX._id.toString(),
    'Context anchor preserved through every governance action'
  );

  console.log('\n-- Section E: Rejection Workflow -----------------------------');

  const rejected = await TimetableVersion.findById(rejOnlyVersion._id).lean();
  assert(rejected.status === 'REJECTED', 'Rejected version remains REJECTED');
  assert(rejected.rejectionReason === 'Needs revision', 'Rejection reason persisted on the exact version');
  assert(
    rejected.academicContextId.toString() === rejOnlyCtx._id.toString(),
    'Rejected version keeps its context anchor'
  );

  const rejectedSessions = await TimetableSession.countDocuments({
    timetableVersionId: rejOnlyVersion._id,
  });
  assert(rejectedSessions === 14, `Rejection did not mutate sessions (${rejectedSessions})`);

  const rejMutate = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/session',
    headers: tcHeaders,
    body: {
      timetableVersionId: rejOnlyVersion._id,
      academicContextId: rejOnlyCtx._id.toString(),
      courseCode: THEORY_1,
      facultyId: FAC_A,
      day: 'FRI',
      period: 'P1',
    },
  });
  assert(
    rejMutate.statusCode === 409 && codeOf(rejMutate) === 'TIMETABLE_VERSION_NOT_EDITABLE',
    `TC cannot mutate a REJECTED version (HTTP ${rejMutate.statusCode})`
  );

  const revision = await createMultiFacultyVersion(rejOnlyCtx, 'P6-Revision-After-Reject');
  assert(
    revision._id.toString() !== rejOnlyVersion._id.toString(),
    'Revision uses a NEW version, not the rejected one'
  );
  const revSubmit = await submitForApproval(app, revision, rejOnlyCtx, tcHeaders);
  assert(revSubmit.statusCode === 200, 'The new revision version can be submitted normally');

  const rejStillRejected = await TimetableVersion.findById(rejOnlyVersion._id).lean();
  assert(
    rejStillRejected.status === 'REJECTED',
    'Original rejected version stays historical after the revision is submitted'
  );

  console.log('\n-- Section H: Immutability -----------------------------------');

  const immCtx = await createOwnedContext('P6H');
  const immVersion = await createMultiFacultyVersion(immCtx, 'P6-Immutability');
  await submitForApproval(app, immVersion, immCtx, tcHeaders);

  const lockMsg = async (label, expectedStatus) => {
    const add = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/session',
      headers: tcHeaders,
      body: {
        timetableVersionId: immVersion._id,
        academicContextId: immCtx._id.toString(),
        courseCode: THEORY_1,
        facultyId: FAC_A,
        day: 'FRI',
        period: 'P1',
      },
    });
    assert(
      add.statusCode === 409 && codeOf(add) === 'TIMETABLE_VERSION_NOT_EDITABLE',
      `Session create blocked while ${label} (HTTP ${add.statusCode})`
    );

    const first = await TimetableSession.findOne({ timetableVersionId: immVersion._id });
    const del = await makeRequest(app, {
      method: 'DELETE',
      path: `/api/timetable/session/${first._id}`,
      headers: tcHeaders,
    });
    assert(
      del.statusCode === 409 && codeOf(del) === 'TIMETABLE_VERSION_NOT_EDITABLE',
      `Session delete blocked while ${label} (HTTP ${del.statusCode})`
    );

    const regen = await makeRequest(app, {
      method: 'POST',
      path: GENERATE_PATH,
      headers: tcHeaders,
      body: {
        academicContextId: immCtx._id.toString(),
        timetableVersionId: immVersion._id.toString(),
      },
    });
    // The owned context intentionally has no curriculum, so the exact refusal
    // code depends on how far the engine gets before the lock. What must hold is
    // that the frozen version is never regenerated.
    assert(regen.statusCode === 409, `Regeneration blocked while ${label} (HTTP ${regen.statusCode})`);
    const after = await TimetableVersion.findById(immVersion._id).lean();
    assert(
      after.status === expectedStatus && after.totalScheduledPeriods === 14,
      `Frozen version unchanged by the regeneration attempt while ${label}`
    );
  };

  await lockMsg('PENDING_HOD_APPROVAL', 'PENDING_HOD_APPROVAL');
  await transition(app, immVersion._id, 'APPROVED', hodHeaders);
  await lockMsg('APPROVED', 'APPROVED');
  await transition(app, immVersion._id, 'PUBLISHED', hodHeaders);
  await lockMsg('PUBLISHED', 'PUBLISHED');

  const immSessions = await TimetableSession.countDocuments({ timetableVersionId: immVersion._id });
  assert(immSessions === 14, `Frozen timetable session set is unchanged (${immSessions})`);

  console.log('\n-- Section F: Publication & Public Safety --------------------');

  const pubCtx = await createOwnedContext('P6F');
  const pubV1 = await createMultiFacultyVersion(pubCtx, 'P6-Published-V1');
  await submitForApproval(app, pubV1, pubCtx, tcHeaders);
  await transition(app, pubV1._id, 'APPROVED', hodHeaders);
  await transition(app, pubV1._id, 'PUBLISHED', hodHeaders);

  const draftV2 = await createMultiFacultyVersion(pubCtx, 'P6-Generated-V2');
  const pendingV3 = await createMultiFacultyVersion(pubCtx, 'P6-Pending-V3');
  await submitForApproval(app, pendingV3, pubCtx, tcHeaders);

  const classPub = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/class/${pubCtx._id}`,
  });
  assert(classPub.statusCode === 200, 'Public class endpoint returns 200');
  const classSessions = classPub.body?.data?.sessions || [];
  assert(classSessions.length > 0, 'Public class endpoint serves the published timetable');
  assert(
    classSessions.every((s) => s.timetableVersionId === pubV1._id.toString()),
    'Public class endpoint exposes ONLY the published version'
  );
  assert(
    !classSessions.some(
      (s) =>
        s.timetableVersionId === draftV2._id.toString() ||
        s.timetableVersionId === pendingV3._id.toString()
    ),
    'GENERATED and PENDING_HOD_APPROVAL versions never appear publicly'
  );

  const pubEndpoint = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/published/${pubCtx._id}`,
  });
  assert(pubEndpoint.statusCode === 200, 'Published endpoint returns 200');
  const pubSessions = pubEndpoint.body?.data?.sessions || [];
  assert(
    pubSessions.length > 0 && pubSessions.every((s) => s.timetableVersionId === pubV1._id.toString()),
    'Published endpoint serves exactly the published version'
  );

  const pubV4 = await createMultiFacultyVersion(pubCtx, 'P6-Published-V2');
  await submitForApproval(app, pubV4, pubCtx, tcHeaders);
  await transition(app, pubV4._id, 'APPROVED', hodHeaders);
  await transition(app, pubV4._id, 'PUBLISHED', hodHeaders);

  const afterSupersede = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/class/${pubCtx._id}`,
  });
  const afterSessions = afterSupersede.body?.data?.sessions || [];
  assert(
    afterSessions.length > 0 &&
      afterSessions.every((s) => s.timetableVersionId === pubV4._id.toString()),
    'Publishing a new version makes ONLY the newest published version publicly visible'
  );

  const v1Still = await TimetableVersion.findById(pubV1._id).lean();
  assert(
    v1Still.status === 'PUBLISHED',
    'Superseded published version record is preserved (history intact)'
  );
  const v1Sessions = await TimetableSession.countDocuments({ timetableVersionId: pubV1._id });
  assert(v1Sessions === 14, `Superseded published version keeps its ${v1Sessions} sessions`);

  console.log('\n-- Section I: Cross-Context Leakage --------------------------');

  const leakRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/class/${ctxX._id}`,
  });
  const leakSessions = leakRes.body?.data?.sessions || [];
  assert(
    leakSessions.every((s) => s.academicContextId === ctxX._id.toString()),
    'Class timetable for Context A never returns Context B sessions'
  );

  const leakPub = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/published/${ctxX._id}`,
  });
  const leakPubSessions = leakPub.body?.data?.sessions || [];
  assert(
    !leakPubSessions.some((s) => s.timetableVersionId === pubV4._id.toString()),
    'Published read for Context A never returns Context B version'
  );

  console.log('\n-- Section G: Multi-Faculty Fidelity ------------------------');

  const mfCtx = await createOwnedContext('P6G');
  const mfVersion = await createMultiFacultyVersion(mfCtx, 'P6-MultiFaculty');

  const checkMultiFaculty = async (label) => {
    const sessions = await readSessions(mfCtx._id.toString(), mfVersion._id.toString());

    const lab3 = sessions.filter((s) => s.courseCode === LAB_3);
    assert(
      lab3.length === 4,
      `${label}: 3-faculty LAB stays ONE class session per period (${lab3.length})`
    );
    assert(
      lab3.every((s) => (s.facultyAssignments || []).length === 3),
      `${label}: PRIMARY/ADDITIONAL/OPTIONAL preserved on every LAB session`
    );
    const lab3Roles = (lab3[0].facultyAssignments || []).map((a) => a.role).sort();
    assert(
      JSON.stringify(lab3Roles) === JSON.stringify(['ADDITIONAL', 'OPTIONAL', 'PRIMARY']),
      `${label}: LAB roles intact (${lab3Roles.join('/')})`
    );

    const sas = sessions.filter((s) => s.courseCode === SAS_1);
    assert(sas.length === 3, `${label}: MC_SAS stays one session per period (${sas.length})`);
    const sasRoles = (sas[0].facultyAssignments || []).map((a) => a.role).sort();
    assert(
      JSON.stringify(sasRoles) === JSON.stringify(['ENGLISH', 'MATHS_BME']),
      `${label}: MC_SAS MATHS_BME/ENGLISH preserved (${sasRoles.join('/')})`
    );

    const lab2 = sessions.filter((s) => s.courseCode === LAB_2);
    assert(
      lab2.length === 4 && lab2.every((s) => (s.facultyAssignments || []).length === 2),
      `${label}: 2-faculty LAB preserved`
    );
  };

  await checkMultiFaculty('GENERATED');
  await submitForApproval(app, mfVersion, mfCtx, tcHeaders);
  await checkMultiFaculty('PENDING_HOD_APPROVAL');
  await transition(app, mfVersion._id, 'APPROVED', hodHeaders);
  await checkMultiFaculty('APPROVED');
  await transition(app, mfVersion._id, 'PUBLISHED', hodHeaders);
  await checkMultiFaculty('PUBLISHED');

  for (const fid of [FAC_A, FAC_B, FAC_C, FAC_MATHS, FAC_ENG]) {
    const fac = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/faculty/${fid}?versionId=${mfVersion._id}`,
    });
    const facSessions = fac.body?.data?.sessions || [];
    assert(facSessions.length > 0, `Faculty ${fid} still sees assigned sessions after PUBLISHED`);
    assert(
      facSessions.every((s) => s.timetableVersionId === mfVersion._id.toString()),
      `Faculty ${fid} timetable is scoped to the exact version`
    );
  }

  await teardown();

  const leftoverCtx = await AcademicContext.countDocuments({ _id: { $in: owned.contextIds } });
  const leftoverVer = await TimetableVersion.countDocuments({ _id: { $in: owned.versionIds } });
  const leftoverSess = await TimetableSession.countDocuments({
    timetableVersionId: { $in: owned.versionIds },
  });
  assert(leftoverCtx === 0, 'No temporary AcademicContext left behind');
  assert(leftoverVer === 0, 'No temporary TimetableVersion left behind');
  assert(leftoverSess === 0, 'No temporary TimetableSession left behind');

  console.log('\n===============================================================');
  console.log(`PHASE 6 TEST RESULTS: ${passCount} PASS | ${failCount} FAIL | ${skipCount} SKIP`);
  console.log('===============================================================');

  if (failCount > 0) {
    console.error(`\n${failCount} test(s) failed. Review output above.`);
  } else {
    console.log('\nALL TESTS PASSED');
  }

  await disconnectDB();
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(async (err) => {
  console.error('Fatal test error:', err);
  try {
    await teardown();
  } catch (_) {
    /* best effort */
  }
  await disconnectDB();
  process.exit(1);
});
