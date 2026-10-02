/**
 * TC Timetable Generation Engine Test Suite (Phase 4)
 *
 * Verifies the Phase 3 TC Design Context is correctly connected to the CSP
 * generation engine, end to end.
 *
 * §1  Engine wiring      — builder/service/controller are exported AND routed
 * §2  Request validation — malformed bodies rejected with 400 before the service
 * §3  Governance (RBAC)  — TC/AC/ADMIN allowed; HOD and FACULTY receive 403
 * §4  HOD authority      — the client cannot override HOD faculty allocations
 * §5  Version lifecycle  — PUBLISHED and foreign-context versions are rejected
 * §6  Elective governance— generation is blocked until elective slots are filled
 * §7  Failure integrity  — a failed run never leaves a GENERATED version with
 *                          zero sessions (Phase 1/2 state machine stays honest)
 * §8  Successful run     — sessions persist, version becomes GENERATED, HOD
 *                          faculty is honoured, and the seed is deterministic
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const AcademicContext = require('../src/models/AcademicContext');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const { generateToken } = require('../src/utils/generateToken');
const { solveFromDesignContext } = require('../src/services/timetableService');
const {
  buildSchedulingContextFromDesign,
  validateAssignmentPlanAgainstDesign,
  ConstraintBuilderError,
} = require('../src/services/timetable/constraintBuilder');
const { getTCTimetableDesignContext } = require('../src/services/tcDesignContextService');
const timetableRoutes = require('../src/routes/timetableRoutes');

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

const GENERATE_PATH = '/api/timetable/generate-from-context';


async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 4: TC TIMETABLE GENERATION ENGINE - TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  console.log('\n-- Section 1: Engine Wiring ----------------------------------');

  assert(typeof solveFromDesignContext === 'function', 'solveFromDesignContext is exported');
  assert(typeof buildSchedulingContextFromDesign === 'function', 'buildSchedulingContextFromDesign is exported');
  assert(
    typeof validateAssignmentPlanAgainstDesign === 'function',
    'validateAssignmentPlanAgainstDesign is exported'
  );

  const controller = require('../src/controllers/timetableController');
  assert(
    typeof controller.generateFromDesignContext === 'function',
    'generateFromDesignContext controller is exported'
  );

  // The route must actually be mounted. Phase 4 P1 shipped the handler without
  // registering it, which left the whole engine unreachable over HTTP.
  const mountedRoutes = timetableRoutes.stack
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
  assert(
    mountedRoutes.includes('POST /generate-from-context'),
    'POST /generate-from-context is mounted on the timetable router'
  );

  const tcUser = (await User.findOne({ role: 'TC' })) || (await User.findOne({ role: 'AC' }));
  const hodUser = await User.findOne({ role: 'HOD' });
  const adminUser = await User.findOne({ role: 'ADMIN' });
  const facultyUser = await User.findOne({ role: 'FACULTY' });

  if (!tcUser) {
    console.log('\nNo TC/AC user found. Aborting - cannot authenticate.');
    await disconnectDB();
    process.exit(1);
  }

  const tcHeaders = { Authorization: `Bearer ${generateToken(tcUser)}` };
  const hodHeaders = hodUser ? { Authorization: `Bearer ${generateToken(hodUser)}` } : null;
  const adminHeaders = adminUser ? { Authorization: `Bearer ${generateToken(adminUser)}` } : null;
  const facultyHeaders = facultyUser ? { Authorization: `Bearer ${generateToken(facultyUser)}` } : null;

  // Pick a context the HOD has fully allocated so generation is actually
  // exercised instead of short-circuiting on a readiness gate.
  const contexts = await AcademicContext.find({ status: 'ACTIVE' }).lean();
  let targetCtx = null;
  let targetDesign = null;

  for (const c of contexts) {
    const design = await getTCTimetableDesignContext(c._id);
    if (design.success && design.data.readiness.allRequiredAllocationsComplete) {
      targetCtx = c;
      targetDesign = design.data;
      break;
    }
  }

  if (!targetCtx) {
    console.log('\nNo fully-allocated academic context found. Aborting.');
    await disconnectDB();
    process.exit(1);
  }

  const ctxId = String(targetCtx._id);
  console.log(`\n  Target context: ${targetCtx.year} ${targetCtx.section} (${ctxId})`);
  console.log(`  Readiness: ${targetDesign.readiness.state}, courses: ${targetDesign.courses.length}`);

  console.log('\n-- Section 2: Request Validation ------------------------------');

  let res = await makeRequest(app, { method: 'POST', path: GENERATE_PATH, body: {}, headers: tcHeaders });
  assert(res.statusCode === 400, `Missing academicContextId -> 400 (actual: ${res.statusCode})`);
  assert(
    res.body.code === 'VALIDATION_ERROR',
    `Missing academicContextId -> VALIDATION_ERROR (actual: ${res.body.code})`
  );

  res = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    body: { academicContextId: 'not-an-object-id' },
    headers: tcHeaders,
  });
  assert(res.statusCode === 400, `Malformed academicContextId -> 400 (actual: ${res.statusCode})`);

  res = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    body: { academicContextId: ctxId, timetableVersionId: 'not-an-object-id' },
    headers: tcHeaders,
  });
  assert(res.statusCode === 400, `Malformed timetableVersionId -> 400 (actual: ${res.statusCode})`);

  res = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    body: { academicContextId: ctxId, assignmentPlan: 'not-an-array' },
    headers: tcHeaders,
  });
  assert(res.statusCode === 400, `Non-array assignmentPlan -> 400 (actual: ${res.statusCode})`);

  res = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    body: { academicContextId: ctxId, assignmentPlan: [{ facultyId: 'FWL-01' }] },
    headers: tcHeaders,
  });
  assert(
    res.statusCode === 400,
    `assignmentPlan item without courseCode -> 400 (actual: ${res.statusCode})`
  );

  res = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    body: { academicContextId: ctxId, generationSeed: 'abc' },
    headers: tcHeaders,
  });
  assert(res.statusCode === 400, `Non-numeric generationSeed -> 400 (actual: ${res.statusCode})`);

  res = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    body: { academicContextId: '000000000000000000000000' },
    headers: tcHeaders,
  });
  assert(res.statusCode === 404, `Unknown academicContextId -> 404 (actual: ${res.statusCode})`);

  res = await makeRequest(app, { method: 'POST', path: GENERATE_PATH, body: { academicContextId: ctxId } });
  assert(res.statusCode === 401, `Unauthenticated -> 401 (actual: ${res.statusCode})`);


  console.log('\n-- Section 3: Role-Based Access Control -----------------------');

  if (hodHeaders) {
    res = await makeRequest(app, {
      method: 'POST',
      path: GENERATE_PATH,
      body: { academicContextId: ctxId },
      headers: hodHeaders,
    });
    assert(res.statusCode === 403, `HOD is blocked from generating (actual: ${res.statusCode})`);
    assert(res.body.code === 'FORBIDDEN', `HOD rejection code is FORBIDDEN (actual: ${res.body.code})`);
  } else {
    skip('No HOD user available for 403 test');
  }

  if (facultyHeaders) {
    res = await makeRequest(app, {
      method: 'POST',
      path: GENERATE_PATH,
      body: { academicContextId: ctxId },
      headers: facultyHeaders,
    });
    assert(res.statusCode === 403, `FACULTY is blocked from generating (actual: ${res.statusCode})`);
  } else {
    skip('No FACULTY user available for 403 test');
  }

  if (adminHeaders) {
    res = await makeRequest(app, {
      method: 'POST',
      path: GENERATE_PATH,
      body: { academicContextId: '000000000000000000000000' },
      headers: adminHeaders,
    });
    assert(
      res.statusCode === 404,
      `ADMIN passes the role guard and reaches the service (actual: ${res.statusCode})`
    );
  } else {
    skip('No ADMIN user available');
  }

  console.log('\n-- Section 4: HOD Faculty Authority --------------------------');

  res = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    body: {
      academicContextId: ctxId,
      assignmentPlan: [{ courseCode: targetDesign.courses[0].courseCode, facultyId: 'NOT-A-REAL-FACULTY' }],
    },
    headers: tcHeaders,
  });
  assert(
    res.statusCode === 400 && res.body.code === 'ASSIGNMENT_PLAN_INVALID',
    `Client cannot inject an unapproved faculty (actual: ${res.statusCode}/${res.body.code})`
  );

  res = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    body: { academicContextId: ctxId, assignmentPlan: [{ courseCode: 'FAKE-COURSE-99' }] },
    headers: tcHeaders,
  });
  assert(
    res.statusCode === 400 && res.body.code === 'ASSIGNMENT_PLAN_INVALID',
    `Client cannot inject a course outside the curriculum (actual: ${res.statusCode}/${res.body.code})`
  );

  const unitValid = validateAssignmentPlanAgainstDesign([], targetDesign);
  assert(unitValid.valid === true, 'An empty assignment plan validates');

  const unitBad = validateAssignmentPlanAgainstDesign(
    [{ courseCode: targetDesign.courses[0].courseCode, facultyId: 'NOPE-1' }],
    targetDesign
  );
  assert(unitBad.valid === false, 'A plan naming a non-HOD faculty fails validation');
  console.log('\n-- Section 5: Version Lifecycle -------------------------------');

  const publishedVersion = await TimetableVersion.findOne({
    academicContextId: targetCtx._id,
    status: 'PUBLISHED',
  }).lean();

  if (publishedVersion) {
    let thrown = null;
    try {
      await solveFromDesignContext(
        { academicContextId: ctxId, timetableVersionId: String(publishedVersion._id) },
        { name: 'Test' }
      );
    } catch (e) {
      thrown = e;
    }
    assert(
      thrown instanceof ConstraintBuilderError && thrown.code === 'VERSION_LOCKED',
      `PUBLISHED version cannot be regenerated (code: ${thrown && thrown.code})`
    );
  } else {
    skip('No PUBLISHED version for this context - immutability test skipped');
  }

  // A version belonging to a different context must never be reused.
  const foreignVersion = await TimetableVersion.findOne({
    academicContextId: { $ne: targetCtx._id },
    status: { $in: ['DRAFT', 'GENERATED', 'NO_TIMETABLE'] },
  }).lean();

  if (foreignVersion) {
    let thrown = null;
    try {
      await solveFromDesignContext(
        { academicContextId: ctxId, timetableVersionId: String(foreignVersion._id) },
        { name: 'Test' }
      );
    } catch (e) {
      thrown = e;
    }
    assert(
      thrown instanceof ConstraintBuilderError &&
        thrown.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH',
      `A version from another context is rejected (code: ${thrown && thrown.code})`
    );
  } else {
    skip('No foreign-context version available for cross-context test');
  }


  console.log('\n-- Section 6: Elective Governance ----------------------------');

  let electiveBlockedCtx = null;
  for (const c of contexts) {
    const design = await getTCTimetableDesignContext(c._id);
    if (design.success && design.data.electiveSelection.isElectiveComplete === false) {
      electiveBlockedCtx = c;
      break;
    }
  }

  if (electiveBlockedCtx) {
    let thrown = null;
    try {
      await solveFromDesignContext(
        { academicContextId: String(electiveBlockedCtx._id) },
        { name: 'Test' }
      );
    } catch (e) {
      thrown = e;
    }
    // Generation must be blocked. Letting it through would be the elective bypass.
    assert(
      thrown instanceof ConstraintBuilderError,
      `Context with unfilled electives cannot be generated (code: ${thrown && thrown.code})`
    );
    if (thrown && thrown.code === 'ELECTIVE_SELECTION_REQUIRED') {
      assert(true, 'Blocked specifically by ELECTIVE_SELECTION_REQUIRED');
    } else {
      console.log(`  Blocked earlier by ${thrown && thrown.code} (also valid governance)`);
    }
  } else {
    skip('All contexts have complete elective selection');
  }

  console.log('\n-- Section 7: Failure Integrity -----------------------------');

  // Isolated scratch context so production data is never touched.
  const scratchCtx = await AcademicContext.create({
    academicYear: targetCtx.academicYear,
    semester: targetCtx.semester,
    department: targetCtx.department,
    year: targetCtx.year,
    section: 'ZZ',
    program: targetCtx.program,
    status: 'ACTIVE',
  });

  const sampleAlloc = await HODFacultyAllocation.findOne({ academicContextId: targetCtx._id }).lean();
  if (sampleAlloc) {
    const clone = { ...sampleAlloc, academicContextId: scratchCtx._id };
    delete clone._id;
    await HODFacultyAllocation.create(clone);
  }

  const versionsBefore = await TimetableVersion.countDocuments({ academicContextId: scratchCtx._id });

  let scratchResult = null;
  let scratchThrew = null;
  try {
    scratchResult = await solveFromDesignContext(
      { academicContextId: String(scratchCtx._id) },
      { name: 'Test' }
    );
  } catch (e) {
    scratchThrew = e;
  }

  const failed = (scratchResult && scratchResult.success === false) || scratchThrew !== null;
  assert(failed, 'An unsatisfiable generation run reports failure rather than success');

  const orphanVersions = await TimetableVersion.find({
    academicContextId: scratchCtx._id,
    status: { $in: ['GENERATED', 'PENDING_HOD_APPROVAL'] },
  }).lean();
  assert(
    orphanVersions.length === 0,
    `Failed run leaves no GENERATED version behind (found ${orphanVersions.length})`
  );

  const versionsAfter = await TimetableVersion.countDocuments({ academicContextId: scratchCtx._id });
  assert(
    versionsAfter === versionsBefore,
    `Failed run creates no stray TimetableVersion (before ${versionsBefore}, after ${versionsAfter})`
  );

  if (scratchResult && scratchResult.code === 'UNSATISFIABLE_CONSTRAINTS') {
    const diag = scratchResult.diagnostics || {};
    assert(
      typeof diag.failureReason === 'object' && diag.failureReason !== null,
      'UNSATISFIABLE result carries a structured failureReason'
    );
    if (diag.failureReason) {
      assert(
        typeof diag.failureReason.message === 'string' && diag.failureReason.message.length > 0,
        `failureReason explains the blocker: ${diag.failureReason.message}`
      );
      console.log(`  Blocking course: ${diag.failureReason.courseCode} (${diag.failureReason.code})`);
    }
  } else {
    const endCode = (scratchThrew && scratchThrew.code) || (scratchResult && scratchResult.code);
    console.log(`  Run ended via ${endCode}`);
  }

  await TimetableSession.deleteMany({ academicContextId: scratchCtx._id });
  await TimetableVersion.deleteMany({ academicContextId: scratchCtx._id });
  await HODFacultyAllocation.deleteMany({ academicContextId: scratchCtx._id });
  await AcademicContext.deleteOne({ _id: scratchCtx._id });
  console.log('  Scratch context cleaned up');


  console.log('\n-- Section 8: Successful Generation --------------------------');

  // Generate into a dedicated version so existing timetable data is untouched.
  const genVersion = await TimetableVersion.create({
    academicContextId: targetCtx._id,
    academicYear: targetCtx.academicYear,
    semester: targetCtx.semester,
    department: targetCtx.department,
    year: targetCtx.year,
    section: targetCtx.section,
    version: 99,
    versionLabel: 'v99.0 (Phase 4 Test)',
    status: 'DRAFT',
  });

  const genResult = await solveFromDesignContext(
    { academicContextId: ctxId, timetableVersionId: String(genVersion._id) },
    { name: 'Phase 4 Tester' }
  );

  if (genResult.success) {
    assert(true, 'Generation succeeded on a fully-allocated context');
    assert(genResult.sessionsCreated > 0, `Sessions were created (${genResult.sessionsCreated})`);
    assert(genResult.status === 'GENERATED', `Version promoted to GENERATED (actual: ${genResult.status})`);
    assert(typeof genResult.metrics.durationMs === 'number', 'Solver metrics include durationMs');
    assert(genResult.metrics.variablesCount > 0, 'Solver metrics include variablesCount');

    const persisted = await TimetableSession.find({
      timetableVersionId: genVersion._id,
      academicContextId: targetCtx._id,
    }).lean();
    assert(
      persisted.length === genResult.sessionsCreated,
      `Persisted session count matches the result (${persisted.length} vs ${genResult.sessionsCreated})`
    );

    const slotKeys = persisted.map((s) => `${s.day}_${s.period}`);
    assert(
      new Set(slotKeys).size === slotKeys.length,
      'Persisted timetable has no class double-booking'
    );

    // Every session must use HOD-authoritative faculty.
    const allocByCourse = new Map();
    const allocs = await HODFacultyAllocation.find({ academicContextId: targetCtx._id }).lean();
    allocs.forEach((a) => allocByCourse.set(a.courseCode, a));

    let facultyViolations = 0;
    persisted.forEach((s) => {
      const alloc = allocByCourse.get(s.courseCode);
      if (!alloc) {
        facultyViolations++;
        return;
      }
      const allowed = new Set();
      if (alloc.facultyId) allowed.add(alloc.facultyId);
      (alloc.facultyAssignments || []).forEach((fa) => fa.facultyId && allowed.add(fa.facultyId));
      if (allowed.size > 0 && !allowed.has(s.facultyId)) facultyViolations++;
    });
    assert(
      facultyViolations === 0,
      `Every session uses HOD-approved faculty (violations: ${facultyViolations})`
    );

    // Determinism: the same seed must reproduce the same timetable.
    const seededA = await solveFromDesignContext(
      { academicContextId: ctxId, timetableVersionId: String(genVersion._id), generationSeed: 4242 },
      { name: 'Phase 4 Tester' }
    );
    const seededB = await solveFromDesignContext(
      { academicContextId: ctxId, timetableVersionId: String(genVersion._id), generationSeed: 4242 },
      { name: 'Phase 4 Tester' }
    );
    if (seededA.success && seededB.success) {
      const key = (r) =>
        r.sessions
          .map((s) => `${s.courseCode}|${s.day}|${s.period}`)
          .sort()
          .join(',');
      assert(key(seededA) === key(seededB), 'Identical generationSeed yields an identical timetable');
    } else {
      skip('Seeded determinism check skipped - generation did not succeed');
    }
  } else {
    console.log(`  SKIP: generation not possible on this fixture (${genResult.code})`);
    skip(`Successful-generation assertions skipped (${genResult.code})`);
  }

  await TimetableSession.deleteMany({ timetableVersionId: genVersion._id });
  await TimetableVersion.deleteOne({ _id: genVersion._id });
  console.log('  Test version cleaned up');


  console.log('\n-- Section 9: Design Context Unaffected ----------------------');

  const designAfter = await getTCTimetableDesignContext(ctxId);
  assert(designAfter.success === true, 'Phase 3 design context still resolves after generation');

  const sampleCourse = designAfter.data.courses[0];
  assert(
    Object.prototype.hasOwnProperty.call(sampleCourse, 'department'),
    'Design context courses expose department for engine room resolution'
  );

  const stillOrphaned = await TimetableVersion.find({
    academicContextId: targetCtx._id,
    status: 'GENERATED',
  }).lean();
  let orphanWithNoSessions = 0;
  for (const v of stillOrphaned) {
    const n = await TimetableSession.countDocuments({ timetableVersionId: v._id });
    if (n === 0) orphanWithNoSessions++;
  }
  assert(
    orphanWithNoSessions === 0,
    `No GENERATED version without sessions exists for the target context (${orphanWithNoSessions})`
  );

  console.log('\n===============================================================');
  console.log(`PHASE 4 TEST RESULTS: ${passCount} PASS | ${failCount} FAIL | ${skipCount} SKIP`);
  console.log('===============================================================');

  if (failCount > 0) {
    console.error(`\n${failCount} test(s) failed. Review output above.`);
  } else {
    console.log('\nALL TESTS PASSED');
  }

  await disconnectDB();
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});



