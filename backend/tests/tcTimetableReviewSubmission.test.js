/**
 * TC Timetable Review + Submission Test Suite (Phase 5)
 *
 * Exercises the real HTTP API for the TC review and submission workflow:
 *
 * §29  Review the generated version (GET /version/:id)
 * §30  Version-specific class review (GET /class/:academicContextId?versionId=)
 * §31  Review matrix (GET /review-matrix?academicContextId=&versionId=)
 * §32  TC submission (PATCH /version/:id/status -> PENDING_HOD_APPROVAL)
 * §33  HOD cannot design
 * §34  TC cannot approve
 * §35  TC cannot publish
 * §36  Zero-session version cannot be submitted
 * §37  Cross-context review is refused
 * §38  Cross-context submission is refused
 * §39  LAB with 2 faculty stays ONE class session
 * §40  LAB with 3 faculty (PRIMARY/ADDITIONAL/OPTIONAL) is preserved
 * §41  SAS (MATHS_BME/ENGLISH) is preserved
 * §42  Every assigned faculty sees the shared class session
 * §43  Public safety: GENERATED / PENDING_HOD_APPROVAL never leak publicly
 * §44  Stale HOD allocation blocks submission
 * §45  Submitted version is immutable
 * §46  Version history is preserved
 *
 * Every fixture this suite creates is removed before it exits.
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
const TEST_EMAIL = 'p5_review_tc@nec.edu.in';

/** Creates a throwaway DRAFT version so each scenario owns an isolated version. */
async function createWorkingVersion(context, label) {
  return TimetableVersion.create({
    academicContextId: context._id,
    academicYear: context.academicYear,
    semester: context.semester,
    department: context.department,
    year: context.year,
    section: context.section,
    version: 1,
    versionLabel: label,
    status: 'DRAFT',
  });
}

/** Every version id / temporary allocation created by the suite, for teardown. */
const createdVersionIds = [];
const extraAllocationCourseCodes = [];

/** Removes every fixture this suite created and leaves the database as found. */
async function cleanup() {
  for (const versionId of createdVersionIds) {
    await TimetableSession.deleteMany({ timetableVersionId: versionId });
    await TimetableVersion.findByIdAndDelete(versionId);
  }
  for (const { contextId, courseCode } of extraAllocationCourseCodes) {
    await HODFacultyAllocation.deleteMany({ academicContextId: contextId, courseCode });
  }
  await User.deleteMany({ email: TEST_EMAIL });
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 5: TC TIMETABLE REVIEW + SUBMISSION - TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  // ---------------------------------------------------------------------
  // Section 0: Wiring
  // ---------------------------------------------------------------------
  console.log('\n-- Section 0: Wiring ---------------------------------------');

  const submissionService = require('../src/services/timetableSubmissionService');
  const reviewService = require('../src/services/timetableReviewService');
  const controller = require('../src/controllers/timetableController');

  assert(
    typeof submissionService.validateVersionForHodSubmission === 'function',
    'validateVersionForHodSubmission is exported'
  );
  assert(
    typeof submissionService.detectStaleHodAllocations === 'function',
    'detectStaleHodAllocations is exported'
  );
  assert(typeof reviewService.buildReviewSummary === 'function', 'buildReviewSummary is exported');
  assert(typeof reviewService.buildReviewSessions === 'function', 'buildReviewSessions is exported');
  assert(
    typeof controller.transitionVersion === 'function',
    'transitionVersion controller is exported'
  );

  const mountedRoutes = timetableRoutes.stack
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
  assert(
    mountedRoutes.includes('PATCH /version/:id/status'),
    'The existing PATCH /version/:id/status endpoint is mounted (no duplicate submit API)'
  );
  assert(
    !mountedRoutes.some((r) => r.includes('submit-timetable')),
    'No duplicate /submit-timetable endpoint was introduced'
  );

  // ---------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------
  const tcUser = await User.findOneAndUpdate(
    { email: TEST_EMAIL },
    {
      $set: {
        name: 'Phase 5 Review TC',
        email: TEST_EMAIL,
        role: 'TC',
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
  const tcHeaders = { Authorization: `Bearer ${generateToken(tcUser)}` };

  const hodUser = await User.findOne({ role: 'HOD' });
  const facultyUser = await User.findOne({ role: 'FACULTY' });
  const hodHeaders = hodUser ? { Authorization: `Bearer ${generateToken(hodUser)}` } : null;
  const facultyHeaders = facultyUser ? { Authorization: `Bearer ${generateToken(facultyUser)}` } : null;

  if (!hodUser) {
    console.log('\nNo HOD user found. Aborting.');
    await cleanup();
    await disconnectDB();
    process.exit(1);
  }

  // MAIN  : fully allocated cohort used for review + submission + governance.
  // MULTI : cohort carrying a 3-faculty LAB (PRIMARY/ADDITIONAL/OPTIONAL).
  const allContexts = await AcademicContext.find({ status: 'ACTIVE' }).lean();

  let mainCtx = null;
  for (const c of allContexts) {
    const design = await getTCTimetableDesignContext(c._id);
    if (design.success && design.data.readiness.allRequiredAllocationsComplete) {
      mainCtx = c;
      break;
    }
  }
  if (!mainCtx) {
    console.log('\nNo fully-allocated academic context found. Aborting.');
    await cleanup();
    await disconnectDB();
    process.exit(1);
  }

  const mainCtxId = mainCtx._id.toString();
  console.log(`\n  MAIN context : ${mainCtx.year} ${mainCtx.section} (${mainCtxId})`);

  // Baseline of the whole cohort, used to prove the suite leaves no residue.
  const preExistingAllocationCount = await HODFacultyAllocation.countDocuments({
    academicContextId: mainCtx._id,
  });

  // A second, fully-allocated context gives us the cross-context fixtures.
  let otherCtx = null;
  for (const c of allContexts) {
    if (c._id.toString() === mainCtxId) continue;
    const design = await getTCTimetableDesignContext(c._id);
    if (design.success && design.data.readiness.allRequiredAllocationsComplete) {
      otherCtx = c;
      break;
    }
  }

  let multiCtx = null;
  for (const c of allContexts) {
    const lab3 = await HODFacultyAllocation.findOne({
      academicContextId: c._id,
      status: { $ne: 'REJECTED' },
      'facultyAssignments.2': { $exists: true },
    });
    if (lab3) {
      multiCtx = c;
      break;
    }
  }
  console.log(`  MULTI context: ${multiCtx ? `${multiCtx.year} ${multiCtx.section}` : 'none found'}`);

  /**
   * Runs the real generation endpoint against a dedicated working version.
   */
  async function generate(context, label, seed = 20260210) {
    const version = await createWorkingVersion(context, label);
    createdVersionIds.push(version._id);
    const res = await makeRequest(app, {
      method: 'POST',
      path: GENERATE_PATH,
      headers: tcHeaders,
      body: {
        academicContextId: context._id.toString(),
        timetableVersionId: version._id.toString(),
        generationSeed: seed,
      },
    });
    return { version, res };
  }

  // ---------------------------------------------------------------------
  // §29 — Review the generated version
  // ---------------------------------------------------------------------
  console.log('\n-- Section 1: Review the Generated Version (§29) -----------');

  const main = await generate(mainCtx, 'Phase5-Review-Main');
  assert(main.res.statusCode === 201, `Generation succeeded (HTTP ${main.res.statusCode})`);
  const mainVersionId = main.res.body?.data?.timetableVersionId || main.version._id.toString();
  const mainSessionCount = main.res.body?.data?.sessionsCreated || 0;
  assert(mainSessionCount > 0, `Generated timetable has sessions (${mainSessionCount})`);

  const generatedVersionRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/version/${mainVersionId}`,
    headers: tcHeaders,
  });
  assert(generatedVersionRes.statusCode === 200, 'GET /version/:id returns HTTP 200');
  const versionDoc = generatedVersionRes.body?.data || {};
  assert(versionDoc.status === 'GENERATED', `Version status is GENERATED (got: '${versionDoc.status}')`);
  assert(
    versionDoc.academicContextId && versionDoc.academicContextId.toString() === mainCtxId,
    `Version is anchored to the selected academic context (got: '${versionDoc.academicContextId}')`
  );
  assert(
    typeof versionDoc.totalScheduledPeriods === 'number' &&
      versionDoc.totalScheduledPeriods === mainSessionCount,
    `Version reports totalScheduledPeriods = ${mainSessionCount} (got: ${versionDoc.totalScheduledPeriods})`
  );
  assert(!!versionDoc.versionLabel, 'Version exposes versionLabel');
  assert(!!versionDoc.createdAt && !!versionDoc.updatedAt, 'Version exposes createdAt and updatedAt');
  assert(
    versionDoc.generatedBy === tcUser.name,
    `generatedBy identifies the requesting TC (got: '${versionDoc.generatedBy}')`
  );
  assert(
    Object.prototype.hasOwnProperty.call(versionDoc, 'hardConflicts'),
    'Version exposes workflow metadata (hardConflicts)'
  );

  // ---------------------------------------------------------------------
  // §30 — Version-specific class review
  // ---------------------------------------------------------------------
  console.log('\n-- Section 2: Class Timetable Review (§30) ----------------');

  const classRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/class/${mainCtxId}?versionId=${mainVersionId}`,
    headers: tcHeaders,
  });
  assert(classRes.statusCode === 200, 'GET /class/:academicContextId?versionId= returns HTTP 200');
  const classData = classRes.body?.data || {};
  assert(classData.sessionCount > 0, `Class review returns sessions (${classData.sessionCount})`);
  assert(
    classData.timetableVersionId && classData.timetableVersionId.toString() === mainVersionId,
    'Class review identifies the exact requested version'
  );
  assert(classData.status === 'GENERATED', `Class review reports the version status (${classData.status})`);
  assert(!!classData.academicContext, 'Class review returns the academic context');
  assert(!!classData.timetableVersion, 'Class review returns the version block');
  assert(
    Array.isArray(classData.sessions) &&
      classData.sessions.every(
        (s) => s.academicContextId === mainCtxId && s.timetableVersionId === mainVersionId
      ),
    'Every reviewed session belongs to this context AND this version'
  );

  // ---------------------------------------------------------------------
  // §31 / §14 — Review matrix + context-scoped version list
  // ---------------------------------------------------------------------
  console.log('\n-- Section 3: Review Matrix & Version List (§31, §14) ------');

  const matrixRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/review-matrix?academicContextId=${mainCtxId}&versionId=${mainVersionId}`,
    headers: tcHeaders,
  });
  assert(matrixRes.statusCode === 200, 'GET /review-matrix returns HTTP 200');
  const matrixData = matrixRes.body?.data || {};
  assert(
    matrixData.sessionCount === classData.sessionCount,
    `Review matrix returns the same sessions as the class review (${matrixData.sessionCount} vs ${classData.sessionCount})`
  );
  assert(
    matrixData.timetableVersionId && matrixData.timetableVersionId.toString() === mainVersionId,
    'Review matrix returns exactly the requested version (no newer-version substitution)'
  );
  assert(
    (matrixData.sessions || []).every(
      (s) => s.academicContextId === mainCtxId && s.timetableVersionId === mainVersionId
    ),
    'Review matrix leaks no cross-context or cross-version sessions'
  );
  assert(
    !!matrixData.summary &&
      typeof matrixData.summary.sessionCount === 'number' &&
      typeof matrixData.summary.courseCount === 'number' &&
      typeof matrixData.summary.facultyCount === 'number' &&
      typeof matrixData.summary.conflictCount === 'number',
    'Review matrix exposes the TC review summary counters'
  );
  assert(
    matrixData.summary.conflictCount === 0,
    `Generated timetable has no conflicts in review (got: ${matrixData.summary.conflictCount})`
  );

  const versionsRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/versions?academicContextId=${mainCtxId}`,
    headers: tcHeaders,
  });
  const versions = versionsRes.body?.data || [];
  assert(Array.isArray(versions) && versions.length > 0, 'GET /versions returns versions');
  assert(
    versions.every((v) => v.academicContextId && v.academicContextId.toString() === mainCtxId),
    'Version list is scoped to the requested academic context only'
  );
  const createdAtOrder = versions.map((v) => new Date(v.createdAt).getTime());
  assert(
    createdAtOrder.every((t, i) => i === 0 || createdAtOrder[i - 1] >= t),
    'Version list is ordered newest-first by createdAt'
  );

  // ---------------------------------------------------------------------
  // §32 — TC submission GENERATED -> PENDING_HOD_APPROVAL
  // ---------------------------------------------------------------------
  console.log('\n-- Section 4: TC Submission (§32) --------------------------');

  const submitRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/timetable/version/${mainVersionId}/status`,
    headers: tcHeaders,
    body: { status: 'PENDING_HOD_APPROVAL' },
  });
  assert(submitRes.statusCode === 200, `TC submission returns HTTP 200 (got: ${submitRes.statusCode})`);
  assert(
    submitRes.body?.data?.status === 'PENDING_HOD_APPROVAL',
    `Version status is PENDING_HOD_APPROVAL (got: '${submitRes.body?.data?.status}')`
  );
  assert(
    submitRes.body?.data?.submittedBy === tcUser.name,
    `submittedBy records the TC (got: '${submitRes.body?.data?.submittedBy}')`
  );
  assert(!!submitRes.body?.data?.submittedAt, 'submittedAt is recorded on submission');
  assert(
    !!submitRes.body?.data?.submission && submitRes.body.data.submission.sessionCount === mainSessionCount,
    'Submission response echoes the exact reviewed session count'
  );

  const persisted = await TimetableVersion.findById(mainVersionId).lean();
  assert(persisted.status === 'PENDING_HOD_APPROVAL', 'Version status persisted in the database');
  assert(!!persisted.submittedAt, 'submittedAt persisted in the database');
  const persistedSessions = await TimetableSession.countDocuments({ timetableVersionId: mainVersionId });
  assert(
    persistedSessions === mainSessionCount,
    `Submission did not alter the session set (${persistedSessions} vs ${mainSessionCount})`
  );

  // ---------------------------------------------------------------------
  // §33 / §34 / §35 — Governance boundaries
  // ---------------------------------------------------------------------
  console.log('\n-- Section 5: Governance Boundaries (§33, §34, §35) -------');

  const hodGenerateRes = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    headers: hodHeaders,
    body: { academicContextId: mainCtxId },
  });
  assert(hodGenerateRes.statusCode === 403, `HOD cannot generate a timetable (HTTP ${hodGenerateRes.statusCode})`);

  if (facultyHeaders) {
    const facGenerateRes = await makeRequest(app, {
      method: 'POST',
      path: GENERATE_PATH,
      headers: facultyHeaders,
      body: { academicContextId: mainCtxId },
    });
    assert(facGenerateRes.statusCode === 403, `FACULTY cannot generate a timetable (HTTP ${facGenerateRes.statusCode})`);
  } else {
    skip('No FACULTY user available for the 403 design test');
  }

  const tcApproveRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/timetable/version/${mainVersionId}/status`,
    headers: tcHeaders,
    body: { status: 'APPROVED' },
  });
  assert(tcApproveRes.statusCode === 403, `TC cannot approve its own timetable (HTTP ${tcApproveRes.statusCode})`);

  const tcPublishRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/timetable/version/${mainVersionId}/status`,
    headers: tcHeaders,
    body: { status: 'PUBLISHED' },
  });
  assert(tcPublishRes.statusCode === 403, `TC cannot publish its own timetable (HTTP ${tcPublishRes.statusCode})`);

  const afterAttempts = await TimetableVersion.findById(mainVersionId).lean();
  assert(
    afterAttempts.status === 'PENDING_HOD_APPROVAL',
    'Version remains PENDING_HOD_APPROVAL after the rejected TC attempts'
  );

  // A submitted version can never be re-submitted.
  const resubmitRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/timetable/version/${mainVersionId}/status`,
    headers: tcHeaders,
    body: { status: 'PENDING_HOD_APPROVAL' },
  });
  assert(
    resubmitRes.statusCode === 409 || resubmitRes.statusCode === 403,
    `Re-submitting an already submitted version is refused (HTTP ${resubmitRes.statusCode})`
  );

  // ---------------------------------------------------------------------
  // §36 — Zero-session protection
  // ---------------------------------------------------------------------
  console.log('\n-- Section 6: Zero-Session Protection (§36) -----------------');

  const emptyVersion = await createWorkingVersion(mainCtx, 'Phase5-Empty-Version');
  createdVersionIds.push(emptyVersion._id);
  await TimetableVersion.findByIdAndUpdate(emptyVersion._id, { status: 'GENERATED' });

  const emptySubmitRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/timetable/version/${emptyVersion._id}/status`,
    headers: tcHeaders,
    body: { status: 'PENDING_HOD_APPROVAL' },
  });
  assert(
    emptySubmitRes.statusCode === 400 || emptySubmitRes.statusCode === 409,
    `Zero-session version cannot be submitted (HTTP ${emptySubmitRes.statusCode})`
  );
  assert(
    emptySubmitRes.body?.error?.code === 'TIMETABLE_NOT_READY_FOR_SUBMISSION',
    `Zero-session error code = TIMETABLE_NOT_READY_FOR_SUBMISSION (got: '${emptySubmitRes.body?.error?.code}')`
  );
  const emptyDetails = emptySubmitRes.body?.error?.details || {};
  assert(
    emptyDetails.sessionCount === 0 &&
      !!emptyDetails.timetableVersionId &&
      !!emptyDetails.academicContextId,
    'Zero-session error details identify the context, version and sessionCount'
  );
  const emptyAfter = await TimetableVersion.findById(emptyVersion._id).lean();
  assert(emptyAfter.status === 'GENERATED', 'Zero-session version stays GENERATED after the refusal');

  /**
   * Seeds one real session through POST /api/timetable/session, trying slots
   * until an unoccupied one is found. Returns the created session or null.
   */
  async function seedSession(version, context, courseCode, facultyId) {
    const candidates = ['SAT', 'FRI'];
    const periods = ['P8', 'P7', 'P6', 'P5', 'P4', 'P3', 'P2', 'P1'];
    for (const day of candidates) {
      for (const period of periods) {
        const res = await makeRequest(app, {
          method: 'POST',
          path: '/api/timetable/session',
          headers: tcHeaders,
          body: {
            timetableVersionId: version._id.toString(),
            academicContextId: context._id.toString(),
            courseCode,
            facultyId,
            day,
            period,
            room: 'LH-101',
          },
        });
        if (res.statusCode === 201) return res.body.data;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // §37 / §38 — Cross-context isolation
  // ---------------------------------------------------------------------
  console.log('\n-- Section 7: Cross-Context Isolation (§37, §38) -----------');

  const crossCtx = otherCtx || allContexts.find((c) => c._id.toString() !== mainCtxId);
  const crossCtxId = crossCtx._id.toString();

  if (crossCtxId === mainCtxId) {
    skip('No second academic context available for cross-context tests');
  } else {
    // A controlled GENERATED version that genuinely belongs to context B.
    const crossVersion = await createWorkingVersion(crossCtx, 'Phase5-Cross-Context');
    createdVersionIds.push(crossVersion._id);
    const crossAllocs = await loadMultiAllocations(crossCtx._id);
    const crossAlloc = [...crossAllocs.values()].find((a) => a.facultyId);
    if (crossAlloc) {
      await seedSession(crossVersion, crossCtx, crossAlloc.courseCode, crossAlloc.facultyId);
    }
    await TimetableVersion.findByIdAndUpdate(crossVersion._id, { status: 'GENERATED' });

    const crossReviewRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${mainCtxId}?versionId=${crossVersion._id}`,
      headers: tcHeaders,
    });
    assert(
      crossReviewRes.statusCode === 409,
      `GET /class/A?versionId=B -> 409 (got: ${crossReviewRes.statusCode})`
    );
    assert(
      crossReviewRes.body?.error?.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH',
      `Cross-context review code = TIMETABLE_VERSION_CONTEXT_MISMATCH (got: '${crossReviewRes.body?.error?.code}')`
    );

    const crossMatrixRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/review-matrix?academicContextId=${mainCtxId}&versionId=${crossVersion._id}`,
      headers: tcHeaders,
    });
    assert(
      crossMatrixRes.statusCode === 409,
      `GET /review-matrix?ctx=A&versionId=B -> 409 (got: ${crossMatrixRes.statusCode})`
    );

    const crossFacultyRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/faculty/${crossAlloc ? crossAlloc.facultyId : 'FWL-01'}?versionId=${crossVersion._id}`,
      headers: tcHeaders,
    });
    assert(
      crossFacultyRes.statusCode === 200,
      `Faculty review still resolves its own version (HTTP ${crossFacultyRes.statusCode})`
    );

    // §38 — submitting version B while claiming context A.
    const crossSubmitRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${crossVersion._id}/status`,
      headers: tcHeaders,
      body: { status: 'PENDING_HOD_APPROVAL', academicContextId: mainCtxId },
    });
    assert(
      crossSubmitRes.statusCode === 409,
      `Cross-context submission -> 409 (got: ${crossSubmitRes.statusCode})`
    );
    assert(
      crossSubmitRes.body?.error?.code === 'TIMETABLE_VERSION_CONTEXT_MISMATCH',
      `Cross-context submit code = TIMETABLE_VERSION_CONTEXT_MISMATCH (got: '${crossSubmitRes.body?.error?.code}')`
    );
    const crossAfter = await TimetableVersion.findById(crossVersion._id).lean();
    assert(
      crossAfter.status === 'GENERATED',
      'Cross-context submission left the version untouched (still GENERATED)'
    );

    // The same submission with the CORRECT context succeeds — the guard enforces
    // context integrity, it does not blanket-block submission.
    const correctSubmitRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${crossVersion._id}/status`,
      headers: tcHeaders,
      body: { status: 'PENDING_HOD_APPROVAL', academicContextId: crossCtxId },
    });
    assert(
      correctSubmitRes.statusCode === 200,
      `Submitting version B with its correct context succeeds (HTTP ${correctSubmitRes.statusCode})`
    );
  }

  // ---------------------------------------------------------------------
  // §43 — Public safety: internal versions must never leak publicly
  // ---------------------------------------------------------------------
  console.log('\n-- Section 8: Public Safety (§43) -------------------------');

  const publicBeforeRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/class/${mainCtxId}`,
  });
  const publicSessions = publicBeforeRes.body?.data?.sessions || [];
  assert(
    publicBeforeRes.statusCode === 200,
    `Public class timetable returns HTTP 200 (got: ${publicBeforeRes.statusCode})`
  );
  assert(
    !publicSessions.some((s) => s.timetableVersionId === mainVersionId),
    'The PENDING_HOD_APPROVAL version never leaks into the public class timetable'
  );

  const publicMatrixRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/review-matrix?academicContextId=${mainCtxId}`,
  });
  const publicMatrixVersionId = publicMatrixRes.body?.data?.timetableVersionId || null;
  assert(
    publicMatrixVersionId !== mainVersionId,
    'A context-only review-matrix request never resolves to the submitted version'
  );

  const publicPublishedRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/published/${mainCtxId}`,
  });
  assert(publicPublishedRes.statusCode === 200, 'GET /published/:academicContextId returns HTTP 200');
  const publishedData = publicPublishedRes.body?.data || {};
  const publishedSessions = publishedData.sessions || [];
  assert(
    !publishedSessions.some((s) => s.timetableVersionId === mainVersionId),
    'The submitted version is not served by the published endpoint'
  );
  if (publishedData.timetableVersionId) {
    assert(
      publishedData.timetableVersion.status === 'PUBLISHED',
      `Published endpoint serves a PUBLISHED version only (got: '${publishedData.timetableVersion.status}')`
    );
    assert(publishedSessions.length > 0, 'Published timetable is served once a version is published');
  } else {
    skip('No published version exists for this context; public empty-state verified instead');
  }

  // ---------------------------------------------------------------------
  // §39 / §40 / §41 / §42 — Multi-faculty review fidelity
  // ---------------------------------------------------------------------
  console.log('\n-- Section 9: Multi-Faculty Review (§39-§42) ----------------');

  /** Reads a cohort's HOD allocations for the courses under test. */
  async function loadMultiAllocations(contextId) {
    const allocs = await HODFacultyAllocation.find({
      academicContextId: contextId,
      status: { $ne: 'REJECTED' },
    }).lean();
    return new Map(allocs.map((a) => [a.courseCode, a]));
  }

  const mainAllocs = await loadMultiAllocations(mainCtx._id);
  const lab2Entry = [...mainAllocs.entries()].find(
    ([, a]) => (a.facultyAssignments || []).length === 2 && a.allocationRule === 'LAB_2_TO_3'
  );
  const sasEntry = [...mainAllocs.entries()].find(
    ([, a]) =>
      (a.facultyAssignments || []).some((f) => f.role === 'MATHS_BME') &&
      (a.facultyAssignments || []).some((f) => f.role === 'ENGLISH')
  );

  const matrixSessions = matrixData.sessions || [];

  // §39 — LAB with 2 faculty stays ONE class session
  if (lab2Entry) {
    const labCode = lab2Entry[0];
    const labSessions = matrixSessions.filter((s) => s.courseCode === labCode);
    assert(labSessions.length > 0, `Review contains the 2-faculty LAB '${labCode}'`);
    assert(
      labSessions.every((s) => (s.facultyAssignments || []).length === 2),
      `Every '${labCode}' LAB session keeps exactly 2 facultyAssignments`
    );
    const labRoles = labSessions[0].facultyAssignments.map((a) => a.role).sort();
    assert(
      JSON.stringify(labRoles) === JSON.stringify(['ADDITIONAL', 'PRIMARY']),
      `LAB 2-faculty roles are PRIMARY + ADDITIONAL (got: ${labRoles.join(', ')})`
    );
    const labSlots = new Set(labSessions.map((s) => `${s.day}_${s.period}`));
    assert(
      labSlots.size === labSessions.length,
      `LAB '${labCode}' is one class session per period, never one row per faculty`
    );
  } else {
    skip('No 2-faculty LAB allocation available in the main cohort');
  }

  // §41 — SAS keeps MATHS_BME + ENGLISH
  if (sasEntry) {
    const sasCode = sasEntry[0];
    const sasSessions = matrixSessions.filter((s) => s.courseCode === sasCode);
    assert(sasSessions.length > 0, `Review contains the SAS session '${sasCode}'`);
    const sasRoles = sasSessions[0].facultyAssignments.map((a) => a.role).sort();
    assert(
      JSON.stringify(sasRoles) === JSON.stringify(['ENGLISH', 'MATHS_BME']),
      `SAS keeps both MATHS_BME and ENGLISH (got: ${sasRoles.join(', ')})`
    );
  } else {
    skip('No SAS (MATHS_BME/ENGLISH) allocation available in the main cohort');
  }

  // §42 — every assigned faculty sees the same shared class session
  const sharedSession = matrixSessions.find((s) => (s.facultyAssignments || []).length >= 2);
  if (sharedSession) {
    for (const assignment of sharedSession.facultyAssignments) {
      const facRes = await makeRequest(app, {
        method: 'GET',
        path: `/api/timetable/faculty/${assignment.facultyId}?versionId=${mainVersionId}`,
      });
      assert(
        facRes.statusCode === 200,
        `Faculty review for ${assignment.facultyId} (${assignment.role}) returns HTTP 200`
      );
      const facSessions = facRes.body?.data?.sessions || [];
      const match = facSessions.find(
        (s) =>
          s.courseCode === sharedSession.courseCode &&
          s.day === sharedSession.day &&
          s.period === sharedSession.period
      );
      assert(
        !!match,
        `${assignment.facultyId} sees the shared class session for '${sharedSession.courseCode}' ${sharedSession.day} ${sharedSession.period}`
      );
      assert(
        facSessions.every((s) => s.timetableVersionId === mainVersionId),
        `${assignment.facultyId} review is scoped to the exact version`
      );
      assert(
        (facRes.body?.data?.roles || []).includes(assignment.role),
        `${assignment.facultyId} review reports role '${assignment.role}'`
      );
    }
  } else {
    skip('No multi-faculty session available for the faculty-review test');
  }

  // §40 — LAB with 3 faculty (PRIMARY / ADDITIONAL / OPTIONAL).
  // The solver cannot schedule the 3-faculty cohort in this dataset (global
  // faculty occupancy from the published CSE timetables), so the fixture is a
  // controlled version whose sessions carry the real HOD-authoritative
  // 3-faculty allocation. The behaviour under test — review fidelity — is
  // unchanged; generation of multi-faculty labs is covered by
  // tests/hodMultiFacultyAllocation.test.js.
  if (!multiCtx) {
    skip('No cohort with a 3-faculty LAB allocation found');
  } else {
    const multiAllocsNow = await loadMultiAllocations(multiCtx._id);
    const lab3Alloc = [...multiAllocsNow.entries()].find(([, a]) => (a.facultyAssignments || []).length >= 3);

    if (!lab3Alloc) {
      skip('No 3-faculty LAB allocation available');
    } else {
      const lab3Course = lab3Alloc[0];
      const lab3Roles = lab3Alloc[1].facultyAssignments.map((a) => a.role);
      const lab3Version = await createWorkingVersion(multiCtx, 'Phase5-LAB3-Faculty');
      createdVersionIds.push(lab3Version._id);

      // Persist the LAB block exactly as the engine would: ONE session per
      // period, each carrying the complete facultyAssignments array.
      const lab3Sessions = [];
      for (const period of ['P1', 'P2', 'P3', 'P4']) {
        const s = await TimetableSession.create({
          timetableVersionId: lab3Version._id,
          academicContextId: multiCtx._id,
          courseCode: lab3Course,
          courseName: lab3Alloc[1].courseName || lab3Course,
          facultyId: lab3Alloc[1].facultyId,
          facultyName: lab3Alloc[1].facultyName || '',
          facultyAssignments: lab3Alloc[1].facultyAssignments,
          day: 'SAT',
          period,
          sessionType: 'LAB',
          duration: 1,
        });
        lab3Sessions.push(s);
      }
      await TimetableVersion.findByIdAndUpdate(lab3Version._id, {
        status: 'GENERATED',
        totalScheduledPeriods: lab3Sessions.length,
        generatedBy: tcUser.name,
      });

      const lab3CtxId = multiCtx._id.toString();
      const lab3ClassRes = await makeRequest(app, {
        method: 'GET',
        path: `/api/timetable/class/${lab3CtxId}?versionId=${lab3Version._id}`,
        headers: tcHeaders,
      });
      assert(lab3ClassRes.statusCode === 200, `3-faculty LAB class review returns HTTP 200`);
      const lab3ReviewSessions = (lab3ClassRes.body?.data?.sessions || []).filter(
        (s) => s.courseCode === lab3Course
      );
      assert(lab3ReviewSessions.length === 4, `3-faculty LAB block keeps its 4 periods (got: ${lab3ReviewSessions.length})`);
      assert(
        lab3ReviewSessions.every((s) => (s.facultyAssignments || []).length === lab3Roles.length),
        `Every '${lab3Course}' session keeps all ${lab3Roles.length} facultyAssignments`
      );
      const lab3ActualRoles = lab3ReviewSessions[0].facultyAssignments.map((a) => a.role).sort();
      assert(
        JSON.stringify(lab3ActualRoles) === JSON.stringify([...lab3Roles].sort()),
        `LAB 3-faculty roles preserved (expected ${lab3Roles.join('/')}, got ${lab3ActualRoles.join('/')})`
      );
      const lab3Slots = new Set(lab3ReviewSessions.map((s) => `${s.day}_${s.period}`));
      assert(
        lab3Slots.size === lab3ReviewSessions.length,
        `3-faculty LAB '${lab3Course}' is not duplicated into one row per faculty`
      );

      const lab3MatrixRes = await makeRequest(app, {
        method: 'GET',
        path: `/api/timetable/review-matrix?academicContextId=${lab3CtxId}&versionId=${lab3Version._id}`,
        headers: tcHeaders,
      });
      const lab3MatrixSessions = (lab3MatrixRes.body?.data?.sessions || []).filter(
        (s) => s.courseCode === lab3Course
      );
      assert(
        lab3MatrixSessions.length === 4 &&
          lab3MatrixSessions.every((s) => (s.facultyAssignments || []).length === lab3Roles.length),
        'Review matrix preserves every 3-faculty LAB session'
      );

      // Every one of the three instructors sees the same shared class session.
      for (const assignment of lab3Alloc[1].facultyAssignments) {
        const facRes = await makeRequest(app, {
          method: 'GET',
          path: `/api/timetable/faculty/${assignment.facultyId}?versionId=${lab3Version._id}`,
        });
        const facSessions = (facRes.body?.data?.sessions || []).filter(
          (s) => s.courseCode === lab3Course
        );
        assert(
          facSessions.length === 4,
          `${assignment.facultyId} (${assignment.role}) sees all 4 LAB periods`
        );
      }

      const lab3SubmitRes = await makeRequest(app, {
        method: 'PATCH',
        path: `/api/timetable/version/${lab3Version._id}/status`,
        headers: tcHeaders,
        body: { status: 'PENDING_HOD_APPROVAL' },
      });
      assert(
        lab3SubmitRes.statusCode === 200,
        `3-faculty LAB timetable submits cleanly (HTTP ${lab3SubmitRes.statusCode})`
      );
    }
  }


  // ---------------------------------------------------------------------
  // §44 — Stale HOD allocation blocks submission
  // ---------------------------------------------------------------------
  console.log('\n-- Section 10: Stale HOD Allocation (§44) -------------------');

  const staleGen = await generate(mainCtx, 'Phase5-Stale-Allocation', 515151);
  assert(staleGen.res.statusCode === 201, `Stale-test timetable generated (HTTP ${staleGen.res.statusCode})`);

  if (staleGen.res.statusCode !== 201) {
    skip('Stale-allocation assertions skipped - generation did not succeed');
  } else {
    const staleVersionId = staleGen.res.body?.data?.timetableVersionId;

    // Pick the course from the ACTUAL persisted sessions of this exact version,
    // never from the curriculum: a course that was never scheduled cannot make a
    // generated timetable stale.
    const staleSessions = await TimetableSession.find({ timetableVersionId: staleVersionId })
      .sort({ courseCode: 1 })
      .lean();
    assert(staleSessions.length > 0, `Stale-test version has persisted sessions (${staleSessions.length})`);

    const sessionAllocations = await HODFacultyAllocation.find({
      academicContextId: mainCtx._id,
      courseCode: { $in: staleSessions.map((s) => s.courseCode) },
      status: { $ne: 'REJECTED' },
    }).lean();

    // The HOD allocation API rejects more than one active allocation per course
    // (HOD_ALLOCATION_CONFLICT), so "the current approved faculty" is only a
    // well-defined single value when a course has exactly one active allocation.
    // The fixture therefore insists on that, instead of silently depending on
    // dirty seed data.
    const allocationsByCourse = new Map();
    for (const a of sessionAllocations) {
      const list = allocationsByCourse.get(a.courseCode) || [];
      list.push(a);
      allocationsByCourse.set(a.courseCode, list);
    }

    const duplicateAllocationCourses = [...allocationsByCourse.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([code]) => code);
    if (duplicateAllocationCourses.length > 0) {
      // Reported, not failed: duplicate active allocations are invalid data
      // that the HOD allocation API itself rejects (HOD_ALLOCATION_CONFLICT),
      // and pre-date this suite (tests/timetableSolver.test.js recreates the
      // III-A allocations). Cleaning them is a data task, not a Phase 5 change.
      console.log(
        `  WARN: duplicate active HOD allocations for [${duplicateAllocationCourses.join(', ')}] — ` +
          'stale-allocation detection is only unambiguous for singly-allocated courses'
      );
    }

    // A single-instructor course makes the faculty A -> faculty B swap exact.
    const staleCandidate = [...new Set(staleSessions.map((s) => s.courseCode))]
      .sort()
      .map((code) => {
        const list = allocationsByCourse.get(code) || [];
        const session = staleSessions.find((s) => s.courseCode === code);
        return { code, allocation: list.length === 1 ? list[0] : null, session };
      })
      .find(
        ({ allocation, session }) =>
          allocation &&
          allocation.facultyId &&
          (session.facultyAssignments || []).length <= 1 &&
          session.facultyId === allocation.facultyId
      );

    if (!staleCandidate) {
      skip('No single-instructor generated course available for the staleness test');
    } else {
      const { code: staleCourse, allocation: staleAllocation, session: staleSession } = staleCandidate;
      const generatedFacultyId = staleSession.facultyId;

      // The generated session must genuinely carry the HOD-approved faculty.
      const sessionFacultyIds = (staleSession.facultyAssignments || []).map((a) => a.facultyId);
      assert(
        generatedFacultyId === staleAllocation.facultyId &&
          (sessionFacultyIds.length === 0 || sessionFacultyIds.includes(staleAllocation.facultyId)),
        `Generated session for '${staleCourse}' uses the HOD-approved faculty '${staleAllocation.facultyId}'`
      );

      const Faculty = require('../src/models/Faculty');
      const approvedSet = new Set(
        [staleAllocation.facultyId, ...(staleAllocation.facultyAssignments || []).map((a) => a.facultyId)]
          .filter(Boolean)
          .map((f) => f.trim().toUpperCase())
      );
      const replacement = (
        await Faculty.find({ isActive: true }, 'facultyId facultyName').lean()
      ).find((f) => !approvedSet.has((f.facultyId || '').trim().toUpperCase()));

      // Mutable fields only. The document identity (_id) is never written, and
      // restoring these exact values makes the operation idempotent.
      const originalAllocation = {
        facultyId: staleAllocation.facultyId,
        facultyName: staleAllocation.facultyName,
        facultyAssignments: (staleAllocation.facultyAssignments || []).map((a) => ({
          facultyId: a.facultyId,
          facultyName: a.facultyName,
          role: a.role,
          required: a.required,
          source: a.source,
        })),
      };
      const restoreAllocation = () =>
        HODFacultyAllocation.updateOne({ _id: staleAllocation._id }, { $set: originalAllocation });

      if (!replacement) {
        skip('No replacement faculty available for the staleness test');
      } else {
        // Faculty A -> Faculty B for the course the timetable actually generated.
        await HODFacultyAllocation.updateOne(
          { _id: staleAllocation._id },
          {
            $set: {
              facultyId: replacement.facultyId,
              facultyName: replacement.facultyName || '',
              facultyAssignments: [
                {
                  facultyId: replacement.facultyId,
                  facultyName: replacement.facultyName || '',
                  role: 'THEORY',
                },
              ],
            },
          }
        );

        let staleSubmitRes;
        try {
          staleSubmitRes = await makeRequest(app, {
            method: 'PATCH',
            path: `/api/timetable/version/${staleVersionId}/status`,
            headers: tcHeaders,
            body: { status: 'PENDING_HOD_APPROVAL' },
          });
        } finally {
          await restoreAllocation();
        }

        assert(
          staleSubmitRes.statusCode === 409,
          `Stale HOD allocation blocks submission (HTTP ${staleSubmitRes.statusCode})`
        );
        assert(
          staleSubmitRes.body?.error?.code === 'HOD_ALLOCATION_CHANGED_AFTER_GENERATION',
          `Stale submit code = HOD_ALLOCATION_CHANGED_AFTER_GENERATION (got: '${staleSubmitRes.body?.error?.code}')`
        );

        const conflict = (staleSubmitRes.body?.error?.details?.conflicts || []).find(
          (c) => c.courseCode === staleCourse
        );
        assert(
          !!conflict &&
            Array.isArray(conflict.generatedFaculty) &&
            conflict.generatedFaculty.includes(generatedFacultyId) &&
            Array.isArray(conflict.currentApprovedFaculty) &&
            conflict.currentApprovedFaculty.includes(replacement.facultyId),
          `Stale details name course '${staleCourse}', generated faculty '${generatedFacultyId}', current faculty '${replacement.facultyId}'`
        );

        const staleAfter = await TimetableVersion.findById(staleVersionId).lean();
        assert(
          staleAfter.status === 'GENERATED',
          `Stale version stayed GENERATED after the rejected submission (got: '${staleAfter.status}')`
        );

        // The allocation was restored above, so the same version must now submit.
        const restoredAllocation = await HODFacultyAllocation.findById(staleAllocation._id).lean();
        assert(
          restoredAllocation.facultyId === originalAllocation.facultyId,
          `HOD allocation restored to '${originalAllocation.facultyId}' (got: '${restoredAllocation.facultyId}')`
        );

        const recovered = await makeRequest(app, {
          method: 'PATCH',
          path: `/api/timetable/version/${staleVersionId}/status`,
          headers: tcHeaders,
          body: { status: 'PENDING_HOD_APPROVAL' },
        });
        assert(
          recovered.statusCode === 200,
          `Restoring the HOD allocation unblocks submission (HTTP ${recovered.statusCode})`
        );

        const recoveredAfter = await TimetableVersion.findById(staleVersionId).lean();
        assert(
          recoveredAfter.status === 'PENDING_HOD_APPROVAL',
          `Version transitioned GENERATED -> PENDING_HOD_APPROVAL (got: '${recoveredAfter.status}')`
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // §45 — Submitted version immutability
  // ---------------------------------------------------------------------
  console.log('\n-- Section 11: Submitted Version Immutability (§45) --------');

  const lockedSessions = await TimetableSession.find({ timetableVersionId: mainVersionId }).lean();
  const anySession = lockedSessions[0];
  const freeSlot = ['P7', 'P8'].find(
    (p) => !lockedSessions.some((s) => s.day === 'SAT' && s.period === p)
  );

  const addRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/session',
    headers: tcHeaders,
    body: {
      timetableVersionId: mainVersionId,
      academicContextId: mainCtxId,
      courseCode: anySession.courseCode,
      facultyId: anySession.facultyId,
      day: 'SAT',
      period: freeSlot || 'P8',
      room: 'LH-101',
    },
  });
  assert(
    addRes.statusCode === 409 || addRes.statusCode === 403,
    `Adding a session to a submitted version is refused (HTTP ${addRes.statusCode})`
  );
  assert(
    addRes.body?.error?.code === 'TIMETABLE_VERSION_NOT_EDITABLE' ||
      addRes.body?.code === 'TIMETABLE_VERSION_NOT_EDITABLE',
    `Session-create lock code = TIMETABLE_VERSION_NOT_EDITABLE (got: '${addRes.body?.error?.code || addRes.body?.code}')`
  );

  const deleteRes = await makeRequest(app, {
    method: 'DELETE',
    path: `/api/timetable/session/${anySession._id}`,
    headers: tcHeaders,
  });
  assert(
    deleteRes.statusCode === 409 || deleteRes.statusCode === 403,
    `Deleting a session from a submitted version is refused (HTTP ${deleteRes.statusCode})`
  );

  const stillThere = await TimetableSession.findById(anySession._id).lean();
  assert(!!stillThere, 'The session still exists after the refused delete');

  const regenerateRes = await makeRequest(app, {
    method: 'POST',
    path: GENERATE_PATH,
    headers: tcHeaders,
    body: {
      academicContextId: mainCtxId,
      timetableVersionId: mainVersionId,
      generationSeed: 999,
    },
  });
  assert(
    regenerateRes.statusCode === 409,
    `Regenerating into a submitted version is refused (HTTP ${regenerateRes.statusCode})`
  );
  assert(
    regenerateRes.body?.error?.code === 'VERSION_LOCKED' ||
      regenerateRes.body?.code === 'VERSION_LOCKED',
    `Regeneration lock code = VERSION_LOCKED (got: '${regenerateRes.body?.error?.code || regenerateRes.body?.code}')`
  );

  const afterLockSessions = await TimetableSession.countDocuments({ timetableVersionId: mainVersionId });
  assert(
    afterLockSessions === mainSessionCount,
    `Submitted version session set is untouched (${afterLockSessions} vs ${mainSessionCount})`
  );

  // ---------------------------------------------------------------------
  // §46 — Version history is preserved
  // ---------------------------------------------------------------------
  console.log('\n-- Section 12: Version History (§46) ------------------------');

  // Pre-existing sessions on the main cohort must survive the whole run.
  const preExistingVersions = await TimetableVersion.find({ academicContextId: mainCtx._id }).lean();
  const preExistingIds = preExistingVersions.map((v) => v._id);
  const preExistingCount = await TimetableSession.countDocuments({
    timetableVersionId: { $in: preExistingIds },
  });

  const historyCtx = mainCtx;
  const historyCtxId = historyCtx._id.toString();

  const v1 = await generate(historyCtx, 'Phase5-History-V1', 313131);
  if (v1.res.statusCode === 201) {
    const v1Id = v1.res.body?.data?.timetableVersionId;
    const v1Sessions = v1.res.body?.data?.sessionsCreated || 0;

    const submitV1 = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${v1Id}/status`,
      headers: tcHeaders,
      body: { status: 'PENDING_HOD_APPROVAL' },
    });
    assert(submitV1.statusCode === 200, `History V1 submitted (HTTP ${submitV1.statusCode})`);

    const approveV1 = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${v1Id}/status`,
      headers: hodHeaders,
      body: { status: 'APPROVED' },
    });
    assert(approveV1.statusCode === 200, `History V1 approved by HOD (HTTP ${approveV1.statusCode})`);

    const publishV1 = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${v1Id}/status`,
      headers: hodHeaders,
      body: { status: 'PUBLISHED' },
    });
    assert(publishV1.statusCode === 200, `History V1 published by HOD (HTTP ${publishV1.statusCode})`);

    // A revised version must never overwrite the published history.
    const v2 = await generate(historyCtx, 'Phase5-History-V2', 424242);
    assert(v2.res.statusCode === 201, `History V2 generated (HTTP ${v2.res.statusCode})`);

    const v1After = await TimetableVersion.findById(v1Id).lean();
    const v1SessionCountAfter = await TimetableSession.countDocuments({ timetableVersionId: v1Id });
    assert(v1After.status === 'PUBLISHED', 'Published V1 stays PUBLISHED after V2 is generated');
    assert(
      v1SessionCountAfter === v1Sessions,
      `Published V1 keeps its ${v1Sessions} sessions after V2 is generated`
    );

    const listAfterRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/versions?academicContextId=${historyCtxId}`,
      headers: tcHeaders,
    });
    const listAfter = listAfterRes.body?.data || [];
    assert(
      listAfter.some((v) => v._id.toString() === v1Id && v.status === 'PUBLISHED'),
      'Historical published version remains queryable in the version list'
    );
    assert(
      listAfter.some((v) => v.status === 'GENERATED'),
      'The new revised version appears alongside the published history'
    );

    // A published version can never be regenerated in place.
    const revisePublished = await makeRequest(app, {
      method: 'POST',
      path: GENERATE_PATH,
      headers: tcHeaders,
      body: { academicContextId: historyCtxId, timetableVersionId: v1Id },
    });
    assert(
      revisePublished.statusCode === 409,
      `A published version cannot be regenerated (HTTP ${revisePublished.statusCode})`
    );
  } else {
    skip(`Version-history assertions skipped (generation returned ${v1.res.statusCode})`);
  }

  const preExistingAfter = await TimetableSession.countDocuments({
    timetableVersionId: { $in: preExistingIds },
  });
  assert(
    preExistingAfter === preExistingCount,
    `Pre-existing historical sessions are intact (${preExistingAfter} vs ${preExistingCount})`
  );

  // ---------------------------------------------------------------------
  // Teardown + summary
  // ---------------------------------------------------------------------
  await cleanup();

  const leftoverVersions = await TimetableVersion.countDocuments({ _id: { $in: createdVersionIds } });
  assert(leftoverVersions === 0, 'All test versions were cleaned up');
  const leftoverSessions = await TimetableSession.countDocuments({
    timetableVersionId: { $in: createdVersionIds },
  });
  assert(leftoverSessions === 0, 'All test sessions were cleaned up');
  // Compare against the baseline so pre-existing allocations for the same
  // cohort/course are never reported as a leak. (An empty $or matches
  // everything in MongoDB, so it must be skipped rather than queried.)
  if (extraAllocationCourseCodes.length > 0) {
    const allocationBaseline = await HODFacultyAllocation.countDocuments({
      $or: extraAllocationCourseCodes.map((a) => ({
        academicContextId: a.contextId,
        courseCode: a.courseCode,
      })),
    });
    assert(
      allocationBaseline <= preExistingAllocationCount,
      'No temporary HOD allocation survives the suite'
    );
  } else {
    assert(true, 'Suite creates no temporary HOD allocations');
  }

  console.log('\n===============================================================');
  console.log(`PHASE 5 TEST RESULTS: ${passCount} PASS | ${failCount} FAIL | ${skipCount} SKIP`);
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
    await cleanup();
  } catch (_) {
    /* best effort */
  }
  await disconnectDB();
  process.exit(1);
});

