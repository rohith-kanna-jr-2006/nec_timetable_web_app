/**
 * Phase 7 — Absence + Substitute Mapping Workflow Test Suite.
 *
 * Covers the real HTTP API for:
 *   A. Authentication (unauthenticated -> 401)
 *   B. RBAC (FACULTY 403, TC/HOD/ADMIN allowed per existing contract)
 *   C. Absence -> exact TimetableSession linkage
 *   D. Session fidelity in the affected-session response
 *   E. Substitute eligibility (server-side filtering)
 *   F. Multi-faculty session handling
 *   G. Persistence and duplicate/conflict rejection
 *   H. AcademicContext / TimetableVersion integrity
 *
 * Every fixture is created inside a dedicated AcademicContext + TimetableVersion
 * and removed on exit. No deleteMany({}) is used and no seeded timetable,
 * absence, substitute or faculty record is mutated or removed.
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const AcademicContext = require('../src/models/AcademicContext');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const Faculty = require('../src/models/Faculty');
const FacultyAbsence = require('../src/models/FacultyAbsence');
const FacultyAvailability = require('../src/models/FacultyAvailability');
const SubstituteAllocation = require('../src/models/SubstituteAllocation');
const { generateToken } = require('../src/utils/generateToken');

let passCount = 0;
let failCount = 0;
let skipCount = 0;

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

const TC_EMAIL = 'p7_substitute_tc@nec.edu.in';
const HOD_EMAIL = 'p7_substitute_hod@nec.edu.in';
const ADMIN_EMAIL = 'p7_substitute_admin@nec.edu.in';
const FACULTY_EMAIL = 'p7_substitute_fac@nec.edu.in';

// Fixture identifiers. All are unique to this suite so cleanup can never touch
// seeded data even if the suite aborts early.
const RUN_TAG = 'P7SUB';
const CTX_A = { academicYear: '2099-2020', semester: '1', department: 'CSE', year: 'III', section: 'A', program: 'UG' };
const CTX_B = { academicYear: '2099-2021', semester: '1', department: 'CSE', year: 'III', section: 'B', program: 'UG' };

const createdUserEmails = [];
const createdContextIds = [];
const createdVersionIds = [];
const createdSessionIds = [];
const createdAbsenceIds = [];
const createdSubstituteIds = [];
const createdFacultyIds = [];
const createdAvailabilityIds = [];

/** Removes every fixture this suite created and leaves the database as found. */
async function cleanup() {
  for (const id of createdSubstituteIds) await SubstituteAllocation.findByIdAndDelete(id);
  for (const id of createdSubstituteIds) {
    // Catch mappings created through the API during the run.
    await SubstituteAllocation.deleteMany({ assignedBy: { $in: createdUserEmails } });
  }
  for (const id of createdAbsenceIds) await FacultyAbsence.findByIdAndDelete(id);
  for (const id of createdSessionIds) await TimetableSession.findByIdAndDelete(id);
  for (const id of createdVersionIds) await TimetableVersion.findByIdAndDelete(id);
  for (const id of createdContextIds) await AcademicContext.findByIdAndDelete(id);
  for (const id of createdAvailabilityIds) await FacultyAvailability.findByIdAndDelete(id);
  for (const id of createdFacultyIds) await Faculty.findByIdAndDelete(id);
  for (const email of createdUserEmails) await User.deleteMany({ email });
}

/** Creates a user for a role, scoped to this suite's email. */
async function makeUser(email, name, role) {
  createdUserEmails.push(email);
  return User.findOneAndUpdate(
    { email },
    { $set: { name, email, role, isActive: true } },
    { upsert: true, new: true }
  );
}

/** Creates an isolated AcademicContext for the run. */
async function makeContext(base, suffix) {
  const ctx = await AcademicContext.create({ ...base, section: suffix, status: 'ACTIVE' });
  createdContextIds.push(ctx._id);
  return ctx;
}

/** Creates an isolated TimetableVersion anchored to a context. */
async function makeVersion(ctx, label) {
  const version = await TimetableVersion.create({
    academicContextId: ctx._id,
    academicYear: ctx.academicYear,
    semester: ctx.semester,
    department: ctx.department,
    year: ctx.year,
    section: ctx.section,
    version: 1,
    versionLabel: label,
    status: 'PUBLISHED',
  });
  createdVersionIds.push(version._id);
  return version;
}

/** Creates an isolated TimetableSession. */
async function makeSession({ ctx, version, courseCode, facultyId, day, period, room, sessionType, facultyAssignments }) {
  const session = await TimetableSession.create({
    timetableVersionId: version._id,
    academicContextId: ctx._id,
    courseCode,
    courseName: `${courseCode} Course`,
    facultyId,
    facultyName: 'Fixture Faculty',
    facultyAssignments: facultyAssignments || [],
    day,
    period,
    room: room || 'LH-101',
    sessionType: sessionType || 'THEORY',
    duration: 1,
  });
  createdSessionIds.push(session._id);
  return session;
}

/** Creates a faculty fixture that does not collide with the seeded master. */
async function makeFaculty(facultyId, name, department) {
  const f = await Faculty.create({
    facultyId,
    facultyName: name,
    designation: 'Assistant Professor',
    department: department || 'Department of Computer Science and Engineering',
    isActive: true,
  });
  createdFacultyIds.push(f._id);
  return f;
}

/** Creates an absence fixture. */
async function makeAbsence({ facultyId, date, status, ctx }) {
  const absence = await FacultyAbsence.create({
    facultyId,
    date,
    reason: RUN_TAG,
    status: status || 'APPROVED',
    academicContextId: ctx ? ctx._id : null,
  });
  createdAbsenceIds.push(absence._id);
  return absence;
}

/** Issues a real HTTP request against the Express app on an ephemeral port. */
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

// Dates are chosen so the derived weekday is deterministic and matches the
// session fixture day. 2026-10-20 is a Tuesday; 2026-10-19 is a Monday.
const TUE = '2026-10-20';
const MON = '2026-10-19';

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 7: ABSENCE + SUBSTITUTE MAPPING - TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  const service = require('../src/services/substituteMappingService');
  const substituteRoutes = require('../src/routes/substituteRoutes');
  const controller = require('../src/controllers/substituteController');

  // -----------------------------------------------------------------
  // Section 0: Wiring
  // -----------------------------------------------------------------
  console.log('\n-- Section 0: Wiring ---------------------------------------');

  assert(typeof service.resolveDayForDate === 'function', 'resolveDayForDate is exported');
  assert(typeof service.resolveAffectedSessions === 'function', 'resolveAffectedSessions is exported');
  assert(typeof service.findEligibleSubstitutes === 'function', 'findEligibleSubstitutes is exported');
  assert(typeof service.createSubstituteMapping === 'function', 'createSubstituteMapping is exported');
  assert(typeof controller.getAffectedSessions === 'function', 'getAffectedSessions controller is exported');
  assert(typeof controller.getEligibleFaculty === 'function', 'getEligibleFaculty controller is exported');

  const mounted = substituteRoutes.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
  assert(mounted.includes('GET /affected-sessions'), 'GET /affected-sessions is mounted');
  assert(mounted.includes('GET /eligible-faculty'), 'GET /eligible-faculty is mounted');

  assert(service.resolveDayForDate(TUE) === 'TUE', 'Date 2026-10-20 resolves to TUE');
  assert(service.resolveDayForDate(MON) === 'MON', 'Date 2026-10-19 resolves to MON');
  assert(service.resolveDayForDate('2026-10-18') === null, 'A Sunday resolves to no timetable day');
  assert(service.resolveDayForDate('2026-02-31') === null, 'An impossible calendar date is rejected');
  assert(service.resolveDayForDate('not-a-date') === null, 'A malformed date is rejected');

  // -----------------------------------------------------------------
  // Fixtures
  // -----------------------------------------------------------------
  const tcUser = await makeUser(TC_EMAIL, 'Phase 7 Substitute TC', 'TC');
  const hodUser = await makeUser(HOD_EMAIL, 'Phase 7 Substitute HOD', 'HOD');
  const adminUser = await makeUser(ADMIN_EMAIL, 'Phase 7 Substitute ADMIN', 'ADMIN');
  const facultyUser = await makeUser(FACULTY_EMAIL, 'Phase 7 Substitute FACULTY', 'FACULTY');

  const tcHeaders = { Authorization: `Bearer ${generateToken(tcUser)}` };
  const hodHeaders = { Authorization: `Bearer ${generateToken(hodUser)}` };
  const adminHeaders = { Authorization: `Bearer ${generateToken(adminUser)}` };
  const facultyHeaders = { Authorization: `Bearer ${generateToken(facultyUser)}` };

  const ctxA = await makeContext(CTX_A, 'A');
  const ctxB = await makeContext(CTX_B, 'B');
  const versionA = await makeVersion(ctxA, 'P7-Version-A');
  const versionB = await makeVersion(ctxB, 'P7-Version-B');

  const absentFacultyId = 'P7-ABSENT-01';
  await makeFaculty(absentFacultyId, 'Phase 7 Absent Faculty');
  const freeSubId = 'P7-FREE-01';
  await makeFaculty(freeSubId, 'Phase 7 Free Substitute');
  const busySubId = 'P7-BUSY-01';
  await makeFaculty(busySubId, 'Phase 7 Busy Substitute');
  const absentSubId = 'P7-ABSENT-02';
  await makeFaculty(absentSubId, 'Phase 7 Absent Substitute');
  const unavailSubId = 'P7-UNAVAIL-01';
  await makeFaculty(unavailSubId, 'Phase 7 Unavailable Substitute');
  const mappedSubId = 'P7-MAPPED-01';
  await makeFaculty(mappedSubId, 'Phase 7 Already Mapped Substitute');
  const multiSubId = 'P7-MULTI-01';
  await makeFaculty(multiSubId, 'Phase 7 Multi Session Substitute');

  // The affected session: absent faculty teaches TUE P1 in context A.
  const sessionA = await makeSession({
    ctx: ctxA,
    version: versionA,
    courseCode: 'P7C01',
    facultyId: absentFacultyId,
    day: 'TUE',
    period: 'P1',
    room: 'LH-701',
    sessionType: 'THEORY',
  });

  // Same weekday+period, context B — proves cross-context isolation.
  const sessionB = await makeSession({
    ctx: ctxB,
    version: versionB,
    courseCode: 'P7C02',
    facultyId: absentFacultyId,
    day: 'TUE',
    period: 'P1',
    room: 'LH-702',
    sessionType: 'THEORY',
  });

  // Busy substitute already teaching another session at the same slot.
  const busySession = await makeSession({
    ctx: ctxA,
    version: versionA,
    courseCode: 'P7C03',
    facultyId: busySubId,
    day: 'TUE',
    period: 'P1',
    room: 'LH-703',
    sessionType: 'THEORY',
  });

  const absenceA = await makeAbsence({ facultyId: absentFacultyId, date: TUE, status: 'APPROVED', ctx: ctxA });
  // Monday absence: the faculty has no Monday session, so nothing is affected.
  const absenceNoSession = await makeAbsence({ facultyId: absentFacultyId, date: MON, status: 'APPROVED', ctx: ctxA });

  // Substitute already mapped at this exact slot by a different absence.
  const mappedAbsence = await makeAbsence({ facultyId: absentFacultyId, date: TUE, status: 'APPROVED', ctx: ctxA });
  const mappedPreExisting = await SubstituteAllocation.create({
    absenceId: mappedAbsence._id,
    originalFacultyId: absentFacultyId,
    substituteFacultyId: mappedSubId,
    timetableSessionId: busySession._id,
    date: TUE,
    period: 'P1',
    day: 'TUE',
    academicContextId: ctxA._id,
    timetableVersionId: versionA._id,
    status: 'ACCEPTED',
    assignedBy: RUN_TAG,
  });
  createdSubstituteIds.push(mappedPreExisting._id);

  // A substitute that is themselves absent on the target date.
  await makeAbsence({ facultyId: absentSubId, date: TUE, status: 'APPROVED', ctx: ctxA });

  // A substitute explicitly unavailable for the slot.
  const unavailRecord = await FacultyAvailability.create({
    facultyId: unavailSubId,
    academicContextId: ctxA._id,
    day: 'TUE',
    period: 'P1',
    status: 'UNAVAILABLE',
    reason: RUN_TAG,
  });
  createdAvailabilityIds.push(unavailRecord._id);

  // -----------------------------------------------------------------
  // A. Authentication
  // -----------------------------------------------------------------
  console.log('\n-- Section A: Authentication ---------------------------------');

  const anonMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    body: { absenceId: absenceA._id, substituteFacultyId: freeSubId, period: 'P1' },
  });
  assert(anonMap.statusCode === 401, `Unauthenticated substitute mapping -> 401 (got ${anonMap.statusCode})`);

  const anonAffected = await makeRequest(app, { method: 'GET', path: `/api/substitutes/affected-sessions?absenceId=${absenceA._id}` });
  assert(anonAffected.statusCode === 401, `Unauthenticated affected-session read -> 401 (got ${anonAffected.statusCode})`);

  const anonEligible = await makeRequest(app, { method: 'GET', path: `/api/substitutes/eligible-faculty?timetableSessionId=${sessionA._id}` });
  assert(anonEligible.statusCode === 401, `Unauthenticated eligible-faculty read -> 401 (got ${anonEligible.statusCode})`);

  // -----------------------------------------------------------------
  // B. RBAC
  // -----------------------------------------------------------------
  console.log('\n-- Section B: RBAC -------------------------------------------');

  const facultyMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: facultyHeaders,
    body: { absenceId: absenceA._id, substituteFacultyId: freeSubId, period: 'P1' },
  });
  assert(facultyMap.statusCode === 403, `FACULTY cannot create a substitute mapping -> 403 (got ${facultyMap.statusCode})`);
  assert(facultyMap.body.code === 'FORBIDDEN', `FACULTY denial code is FORBIDDEN (got '${facultyMap.body.code}')`);

  const facultyAffected = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?absenceId=${absenceA._id}`,
    headers: facultyHeaders,
  });
  assert(facultyAffected.statusCode === 403, `FACULTY cannot read affected sessions -> 403 (got ${facultyAffected.statusCode})`);

  // TC is the operational owner of substitute mapping.
  const tcAffected = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?absenceId=${absenceA._id}&academicContextId=${ctxA._id}&period=P1`,
    headers: tcHeaders,
  });
  assert(tcAffected.statusCode === 200, `TC can read affected sessions -> 200 (got ${tcAffected.statusCode})`);

  // HOD keeps its existing administrative authority.
  const hodAffected = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?absenceId=${absenceA._id}&academicContextId=${ctxA._id}&period=P1`,
    headers: hodHeaders,
  });
  assert(hodAffected.statusCode === 200, `HOD keeps affected-session authority -> 200 (got ${hodAffected.statusCode})`);

  const adminAffected = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?absenceId=${absenceA._id}&academicContextId=${ctxA._id}&period=P1`,
    headers: adminHeaders,
  });
  assert(adminAffected.statusCode === 200, `ADMIN keeps override authority -> 200 (got ${adminAffected.statusCode})`);

  // TC must NOT inherit HOD faculty-allocation authority (scope discipline).
  const tcAllocation = await makeRequest(app, {
    method: 'POST',
    path: '/api/hod-allocations',
    headers: tcHeaders,
    body: {},
  });
  assert(tcAllocation.statusCode === 403, `TC has no HOD faculty-allocation authority -> 403 (got ${tcAllocation.statusCode})`);

  // -----------------------------------------------------------------
  // C. Absence -> TimetableSession linkage
  // -----------------------------------------------------------------
  console.log('\n-- Section C: Absence Linkage --------------------------------');

  const linked = tcAffected.body.data;
  assert(linked.sessionCount === 1, `A valid absence resolves exactly 1 session (got ${linked.sessionCount})`);
  assert(linked.day === 'TUE', `Absence date resolves to TUE (got '${linked.day}')`);
  assert(linked.ambiguity === null, 'A single match reports no ambiguity');

  const resolvedSession = linked.sessions[0];
  assert(resolvedSession.timetableSessionId === String(sessionA._id), 'The resolved session is the exact fixture session');

  // Wrong date: the Monday absence has no matching session.
  const wrongDate = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?absenceId=${absenceNoSession._id}&academicContextId=${ctxA._id}&period=P1`,
    headers: tcHeaders,
  });
  assert(wrongDate.statusCode === 200, 'Wrong-date lookup responds 200');
  assert(wrongDate.body.data.sessionCount === 0, `A wrong date resolves no session (got ${wrongDate.body.data.sessionCount})`);

  // Wrong period: nothing matches P9 on Tuesday.
  const wrongPeriod = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?absenceId=${absenceA._id}&academicContextId=${ctxA._id}&period=P9`,
    headers: tcHeaders,
  });
  assert(wrongPeriod.body.data.sessionCount === 0, `A wrong period resolves no session (got ${wrongPeriod.body.data.sessionCount})`);

  // Wrong faculty: this faculty teaches nothing.
  const absentSubAbsence = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?facultyId=${mappedSubId}&date=${TUE}&period=P1&academicContextId=${ctxA._id}`,
    headers: tcHeaders,
  });
  assert(absentSubAbsence.body.data.sessionCount === 0, `A wrong faculty resolves no session (got ${absentSubAbsence.body.data.sessionCount})`);

  // Cross-context: context A must not resolve the context B session.
  const ctxScoped = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?absenceId=${absenceA._id}&academicContextId=${ctxA._id}&period=P1`,
    headers: tcHeaders,
  });
  assert(ctxScoped.body.data.sessions[0].timetableSessionId === String(sessionA._id), 'Context A resolves only the context A session');
  assert(ctxScoped.body.data.sessions.every((s) => String(s.academicContextId) === String(ctxA._id)), 'No cross-context session leaks into the result');

  // -----------------------------------------------------------------
  // D. Session fidelity
  // -----------------------------------------------------------------
  console.log('\n-- Section D: Session Fidelity ------------------------------');

  const s = resolvedSession;
  assert(!!s.courseCode, 'Affected session carries courseCode');
  assert(s.courseCode === 'P7C01', `courseCode is exact (got '${s.courseCode}')`);
  assert(!!s.courseName, 'Affected session carries courseName');
  assert(s.section === 'A', `class/section is returned (got '${s.section}')`);
  assert(s.room === 'LH-701', `room is returned (got '${s.room}')`);
  assert(s.sessionType === 'THEORY', `sessionType is returned (got '${s.sessionType}')`);
  assert(String(s.academicContextId) === String(ctxA._id), 'academicContextId is returned');
  assert(String(s.timetableVersionId) === String(versionA._id), 'timetableVersionId is returned');
  assert(s.day === 'TUE', `day is returned (got '${s.day}')`);
  assert(s.period === 'P1', `period is returned (got '${s.period}')`);
  assert(s.originalFacultyId === absentFacultyId, 'The original absent faculty is returned');
  assert(Array.isArray(s.facultyAssignments), 'facultyAssignments is always returned as an array');
  assert(s.date === TUE, 'The absence date is returned so the TC never re-enters it');

  // -----------------------------------------------------------------
  // E. Substitute eligibility
  // -----------------------------------------------------------------
  console.log('\n-- Section E: Substitute Eligibility ------------------------');

  const eligibleRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/eligible-faculty?timetableSessionId=${sessionA._id}&absenceId=${absenceA._id}&academicContextId=${ctxA._id}`,
    headers: tcHeaders,
  });
  assert(eligibleRes.statusCode === 200, `Eligible-faculty read -> 200 (got ${eligibleRes.statusCode})`);
  const eligibleIds = (eligibleRes.body.data.eligibleFaculty || []).map((f) => f.facultyId);

  assert(eligibleRes.body.data.day === 'TUE', 'Eligible response reports the slot day');
  assert(eligibleRes.body.data.period === 'P1', 'Eligible response reports the slot period');
  assert(eligibleIds.includes(freeSubId), 'A free eligible faculty member is offered');
  assert(!eligibleIds.includes(absentFacultyId), 'The absent faculty is never offered as their own substitute');
  assert(!eligibleIds.includes(busySubId), 'Faculty teaching another session at the slot is excluded');
  assert(!eligibleIds.includes(absentSubId), 'Faculty absent on the date is excluded');
  assert(!eligibleIds.includes(unavailSubId), 'Faculty marked UNAVAILABLE is excluded');
  assert(!eligibleIds.includes(mappedSubId), 'Faculty already mapped at this slot is excluded');
  const totalFacultyCount = await Faculty.countDocuments({ isActive: { $ne: false } });
  assert(
    eligibleIds.length < totalFacultyCount,
    `The full faculty master is not returned for client-side filtering (${eligibleIds.length} of ${totalFacultyCount})`
  );

  // E: rejections through the real mapping endpoint.
  const baseMap = { absenceId: absenceA._id, period: 'P1', academicContextId: ctxA._id, timetableVersionId: versionA._id };

  const busyMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { ...baseMap, substituteFacultyId: busySubId },
  });
  assert(busyMap.statusCode === 409, `Substitute teaching another session is rejected -> 409 (got ${busyMap.statusCode})`);
  assert(busyMap.body.code === 'SUBSTITUTE_NOT_ELIGIBLE', `Rejection code is SUBSTITUTE_NOT_ELIGIBLE (got '${busyMap.body.code}')`);
  assert(
    (busyMap.body.details?.reasons || []).includes('CONFLICTING_TIMETABLE_SESSION'),
    `Rejection reason is explicit (got ${JSON.stringify(busyMap.body.details?.reasons)})`
  );

  const absentSubMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { ...baseMap, substituteFacultyId: absentSubId },
  });
  assert(absentSubMap.statusCode === 409, `An absent substitute is rejected -> 409 (got ${absentSubMap.statusCode})`);
  assert((absentSubMap.body.details?.reasons || []).includes('ABSENT_ON_DATE'), 'Absent substitute reason is explicit');

  const unavailMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { ...baseMap, substituteFacultyId: unavailSubId },
  });
  assert(unavailMap.statusCode === 409, `An unavailable substitute is rejected -> 409 (got ${unavailMap.statusCode})`);
  assert((unavailMap.body.details?.reasons || []).includes('MARKED_UNAVAILABLE'), 'Unavailable substitute reason is explicit');

  const mappedMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { ...baseMap, substituteFacultyId: mappedSubId },
  });
  assert(mappedMap.statusCode === 409, `A conflicting substitute mapping is rejected -> 409 (got ${mappedMap.statusCode})`);
  assert((mappedMap.body.details?.reasons || []).includes('CONFLICTING_SUBSTITUTE_MAPPING'), 'Conflicting mapping reason is explicit');

  const invalidMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { ...baseMap, substituteFacultyId: 'P7-DOES-NOT-EXIST' },
  });
  assert(invalidMap.statusCode === 404, `An invalid faculty is rejected -> 404 (got ${invalidMap.statusCode})`);
  assert(invalidMap.body.code === 'SUBSTITUTE_FACULTY_NOT_FOUND', `Invalid faculty code is SUBSTITUTE_FACULTY_NOT_FOUND (got '${invalidMap.body.code}')`);

  const selfMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { ...baseMap, substituteFacultyId: absentFacultyId },
  });
  assert(selfMap.statusCode === 409, `The absent faculty cannot substitute themselves -> 409 (got ${selfMap.statusCode})`);
  assert(selfMap.body.code === 'SUBSTITUTE_IS_ORIGINAL_FACULTY', `Self-substitution code is SUBSTITUTE_IS_ORIGINAL_FACULTY (got '${selfMap.body.code}')`);

  // -----------------------------------------------------------------
  // F. Multi-faculty sessions
  // -----------------------------------------------------------------
  console.log('\n-- Section F: Multi-Faculty Sessions ------------------------');

  const multiCtx = await makeContext({ ...CTX_A, academicYear: '2099-2022' }, 'C');
  const multiVersion = await makeVersion(multiCtx, 'P7-Version-Multi');

  const multiSession = await makeSession({
    ctx: multiCtx,
    version: multiVersion,
    courseCode: 'P7LAB1',
    facultyId: absentFacultyId,
    day: 'TUE',
    period: 'P2',
    room: 'LAB-1',
    sessionType: 'LAB',
    facultyAssignments: [
      { facultyId: absentFacultyId, facultyName: 'Phase 7 Absent Faculty', role: 'PRIMARY' },
      { facultyId: multiSubId, facultyName: 'Phase 7 Multi Session Substitute', role: 'ADDITIONAL' },
      { facultyId: freeSubId, facultyName: 'Phase 7 Free Substitute', role: 'OPTIONAL' },
    ],
  });

  const multiAbsence = await makeAbsence({ facultyId: absentFacultyId, date: TUE, status: 'APPROVED', ctx: multiCtx });

  const multiAffected = await makeRequest(app, {
    method: 'GET',
    path: `/api/substitutes/affected-sessions?absenceId=${multiAbsence._id}&academicContextId=${multiCtx._id}&period=P2`,
    headers: tcHeaders,
  });
  assert(multiAffected.body.data.sessionCount === 1, `A multi-faculty session resolves ONE session (got ${multiAffected.body.data.sessionCount})`);

  const multiPayload = multiAffected.body.data.sessions[0];
  assert(multiPayload.facultyCount === 3, `All 3 facultyAssignments are preserved (got ${multiPayload.facultyCount})`);
  assert(multiPayload.facultyAssignments.length === 3, 'facultyAssignments array is complete');
  assert(
    multiPayload.facultyAssignments.map((a) => a.role).join(',') === 'PRIMARY,ADDITIONAL,OPTIONAL',
    'LAB roles are preserved in order'
  );
  assert(multiPayload.sessionType === 'LAB', 'LAB sessionType is preserved');

  const multiSessionCount = await TimetableSession.countDocuments({ academicContextId: multiCtx._id });
  assert(multiSessionCount === 1, 'Reading the affected session never creates a duplicate class session');

  // -----------------------------------------------------------------
  // G. Persistence
  // -----------------------------------------------------------------
  console.log('\n-- Section G: Persistence -----------------------------------');

  const successMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { ...baseMap, substituteFacultyId: freeSubId },
  });
  assert(successMap.statusCode === 201, `A free eligible faculty member is accepted -> 201 (got ${successMap.statusCode})`);

  const created = successMap.body.data;
  if (created && created._id) createdSubstituteIds.push(created._id);

  assert(String(created.absenceId) === String(absenceA._id), 'Mapping persists the exact absence reference');
  assert(String(created.timetableSessionId) === String(sessionA._id), 'Mapping persists the exact session reference');
  assert(String(created.academicContextId) === String(ctxA._id), 'Mapping persists the exact AcademicContext');
  assert(String(created.timetableVersionId) === String(versionA._id), 'Mapping persists the exact TimetableVersion');
  assert(created.originalFacultyId === absentFacultyId, 'Mapping persists the original absent faculty');
  assert(created.substituteFacultyId === freeSubId, 'Mapping persists the substitute faculty');
  assert(created.date === TUE, 'Mapping persists the absence date');
  assert(created.period === 'P1', 'Mapping persists the slot period');
  assert(created.day === 'TUE', 'Mapping persists the resolved weekday');
  assert(created.status === 'PENDING', 'A new mapping defaults to PENDING');

  // Duplicate request is rejected rather than silently creating a second row.
  const duplicateMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { ...baseMap, substituteFacultyId: freeSubId },
  });
  assert(duplicateMap.statusCode === 409, `A duplicate mapping is rejected -> 409 (got ${duplicateMap.statusCode})`);

  const dupCount = await SubstituteAllocation.countDocuments({
    timetableSessionId: sessionA._id,
    substituteFacultyId: freeSubId,
    status: { $in: ['PENDING', 'ACCEPTED'] },
  });
  assert(dupCount === 1, `Only one active mapping exists for the slot (got ${dupCount})`);

  // The TimetableSession must never be mutated to store substitute data.
  const sessionAfter = await TimetableSession.findById(sessionA._id).lean();
  assert(sessionAfter.facultyId === absentFacultyId, 'The original faculty on the session is untouched');
  assert(!('substituteFacultyId' in sessionAfter), 'Substitute data is not written onto TimetableSession');
  assert(sessionAfter.room === 'LH-701', 'Session room is preserved');

  // -----------------------------------------------------------------
  // H. Context / version integrity
  // -----------------------------------------------------------------
  console.log('\n-- Section H: Context + Version Integrity -------------------');

  const ctxBSubId = 'P7-CTXB-01';
  await makeFaculty(ctxBSubId, 'Phase 7 Context B Substitute');

  const crossCtxMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: {
      absenceId: absenceA._id,
      substituteFacultyId: ctxBSubId,
      period: 'P1',
      academicContextId: ctxB._id,
      timetableVersionId: versionB._id,
    },
  });
  assert(crossCtxMap.statusCode === 409, `Context A absence cannot map through Context B -> 409 (got ${crossCtxMap.statusCode})`);
  assert(crossCtxMap.body.code === 'ABSENCE_CONTEXT_MISMATCH', `Cross-context code is ABSENCE_CONTEXT_MISMATCH (got '${crossCtxMap.body.code}')`);

  const wrongVersionMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: {
      absenceId: absenceA._id,
      substituteFacultyId: ctxBSubId,
      period: 'P1',
      academicContextId: ctxA._id,
      timetableVersionId: versionB._id,
    },
  });
  // A version from another context must not be silently substituted for the
// context A session. Resolution is version-scoped, so the correct outcome is a
// refusal: either an explicit mismatch or "no session in that version".
assert(
  [404, 409].includes(wrongVersionMap.statusCode),
    `A wrong version cannot be silently substituted -> 404/409 (got ${wrongVersionMap.statusCode})`
  );
  assert(
    ['SESSION_VERSION_MISMATCH', 'SESSION_NOT_AFFECTED_BY_ABSENCE', 'NO_AFFECTED_SESSION'].includes(wrongVersionMap.body.code),
    `Wrong-version rejection is explicit (got '${wrongVersionMap.body.code}')`
  );
  const leakedByVersion = await SubstituteAllocation.findOne({
    absenceId: absenceA._id,
    substituteFacultyId: ctxBSubId,
  });
  assert(!leakedByVersion, 'No mapping is persisted when the version does not match');

  // A rejected absence cannot be mapped at all.
  const rejectedAbsence = await makeAbsence({ facultyId: absentFacultyId, date: TUE, status: 'REJECTED', ctx: ctxA });
  const rejectedMap = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { absenceId: rejectedAbsence._id, substituteFacultyId: ctxBSubId, period: 'P1', academicContextId: ctxA._id },
  });
  assert(rejectedMap.statusCode === 409, `A rejected absence cannot be mapped -> 409 (got ${rejectedMap.statusCode})`);
  assert(rejectedMap.body.code === 'ABSENCE_NOT_APPROVED', `Rejected absence code is ABSENCE_NOT_APPROVED (got '${rejectedMap.body.code}')`);

  const missingAbsence = await makeRequest(app, {
    method: 'POST',
    path: '/api/substitutes',
    headers: tcHeaders,
    body: { absenceId: '6aba13b47439464f20c4ceef', substituteFacultyId: ctxBSubId, period: 'P1' },
  });
  assert(missingAbsence.statusCode === 404, `An unknown absence -> 404 (got ${missingAbsence.statusCode})`);

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`PHASE 7 SUBSTITUTE MAPPING: ${passCount} PASSED, ${failCount} FAILED, ${skipCount} SKIPPED`);
  console.log('===============================================================\n');
}

(async () => {
  try {
    await runTests();
  } catch (error) {
    failCount++;
    console.error('\n[FATAL] Phase 7 suite aborted:', error && error.message ? error.message : error);
  } finally {
    // Cleanup runs on every path so the suite never leaves residue behind.
    await cleanup();
    await disconnectDB();
  }
  process.exit(failCount > 0 ? 1 : 0);
})();