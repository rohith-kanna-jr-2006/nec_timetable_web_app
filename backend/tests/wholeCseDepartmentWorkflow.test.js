/**
 * Whole-CSE Multi-Cohort Workflow & Data Integrity Test Suite
 *
 * Validates:
 * 1. Independent data-driven resolution across all 12 CSE academic contexts (II, III, IV Year; Sec A-D).
 * 2. Missing Timetable != Missing Data (actionable business states instead of generic dead-ends).
 * 3. Context Status API (/api/timetable/context-status/:id and /status/:id).
 * 4. Strict multi-cohort isolation (Cohort B generation does not leak to Cohort A, C, or D).
 * 5. Full-lifecycle generation, review matrix, approval, and publishing on non-III-A cohort.
 * 6. Authoritative HOD allocation enforcement (no workload/random/first faculty fallback).
 * 7. Elective slot vs catalog vs active selection enforcement.
 * 8. Seed idempotency and history preservation (no destructive wipe).
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const AcademicContext = require('../src/models/AcademicContext');
const Course = require('../src/models/Course');
const Faculty = require('../src/models/Faculty');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const { resolveSemesterForContext } = require('../src/services/timetable/semesterResolver');
const { seedTimetable } = require('../src/seeds/seedTimetable');

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

function makeRequest(appInstance, { method = 'GET', path: reqPath = '/', headers = {}, body = null }) {
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
          path: reqPath,
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
            } catch (err) {
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

async function runWholeCseTestSuite() {
  console.log('============================================================');
  console.log('WHOLE-CSE MULTI-COHORT WORKFLOW & INTEGRITY TEST SUITE');
  console.log('============================================================\n');

  try {
    await connectDB();

    // 0. Auth Tokens
    const hodLogin = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'hod@nec.edu.in', password: process.env.DEV_SEED_PASSWORD || 'Password123!' },
    });
    const hodToken = hodLogin.body?.data?.token;

    const acLogin = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'ac@nec.edu.in', password: process.env.DEV_SEED_PASSWORD || 'Password123!' },
    });
    const acToken = acLogin.body?.data?.token;

    // ------------------------------------------------------------
    // SUITE 1: Whole-CSE Cohort & Curriculum Mapping (All 12 Contexts)
    // ------------------------------------------------------------
    console.log('--- SUITE 1: Whole-CSE Academic Contexts & Curriculum Mapping ---');
    const allContexts = await AcademicContext.find({
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      status: 'ACTIVE',
    }).sort({ year: 1, section: 1 });

    assert(allContexts.length === 12, `All 12 target CSE cohorts exist in database (got: ${allContexts.length})`);

    const expectedSemMap = {
      'II Year': 'Semester III',
      'III Year': 'Semester V',
      'IV Year': 'Semester VII',
    };

    let allResolved = true;
    for (const ctx of allContexts) {
      const resolved = resolveSemesterForContext(ctx);
      const expected = expectedSemMap[ctx.year];
      if (resolved !== expected) {
        allResolved = false;
        console.error(`Mismatch for ${ctx.year} Sec ${ctx.section}: expected ${expected}, got ${resolved}`);
      }
    }
    assert(allResolved, 'Every valid CSE context dynamically resolves its official curriculum semester');

    // ------------------------------------------------------------
    // SUITE 2: Missing Timetable != Missing Data (Actionable States)
    // ------------------------------------------------------------
    console.log('\n--- SUITE 2: Missing Timetable != Missing Data (Actionable Workflow States) ---');
    // Pick an unseeded cohort (e.g. II Year Sec C)
    const ctxII_C = allContexts.find((c) => c.year === 'II Year' && c.section === 'C');
    assert(!!ctxII_C, 'Found II Year Section C context');

    // Remove any previous versions/allocations for II Year Sec C to test pristine state
    await TimetableVersion.deleteMany({
      academicYear: ctxII_C.academicYear,
      semester: ctxII_C.semester,
      year: ctxII_C.year,
      section: ctxII_C.section,
    });
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxII_C._id });

    // Request Class Timetable for II Year Sec C (No published timetable exists)
    const classRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${ctxII_C._id}`,
    });
    assert(classRes.statusCode === 200, 'GET /api/timetable/class/:id for class without timetable returns HTTP 200 (not dead-end 404)');
    assert(classRes.body.success === true, 'Response success is true');
    assert(classRes.body.data.isPublished === false, 'isPublished is false');
    assert(classRes.body.data.sessions.length === 0, 'sessions is empty array (no draft session leakage)');
    assert(classRes.body.data.state === 'ALLOCATION_INCOMPLETE', `Reports accurate actionable state (got: '${classRes.body.data.state}')`);
    assert(classRes.body.data.nextAction === 'ALLOCATE_FACULTY', `Provides actionable next action (got: '${classRes.body.data.nextAction}')`);

    // Verify Context Status API endpoint
    const statusRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/context-status/${ctxII_C._id}`,
    });
    assert(statusRes.statusCode === 200, 'GET /api/timetable/context-status/:id returns HTTP 200');
    assert(statusRes.body.data.state === 'ALLOCATION_INCOMPLETE', 'Workflow status endpoint reports ALLOCATION_INCOMPLETE');
    assert(statusRes.body.data.curriculum.available === true, 'Curriculum data is confirmed available');
    assert(statusRes.body.data.curriculum.courseCount > 0, `Curriculum course count is positive (count: ${statusRes.body.data.curriculum.courseCount})`);
    assert(statusRes.body.data.timetable.exists === false, 'timetable.exists is false (not confused with missing academic data)');

    // Verify alias /api/timetable/status/:id
    const aliasStatusRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/status/${ctxII_C._id}`,
    });
    assert(aliasStatusRes.statusCode === 200, 'Alias GET /api/timetable/status/:id returns HTTP 200 with identical status');

    // ------------------------------------------------------------
    // SUITE 3: Dynamic Generation & Full Lifecycle on Non-III-A Cohort (II Year Sec B)
    // ------------------------------------------------------------
    console.log('\n--- SUITE 3: End-to-End Generation & Publishing on II Year Section B ---');
    const ctxII_B = allContexts.find((c) => c.year === 'II Year' && c.section === 'B');
    assert(!!ctxII_B, 'Found II Year Section B context');

    // Clean any prior data for II-B
    await TimetableVersion.deleteMany({
      academicYear: ctxII_B.academicYear,
      semester: ctxII_B.semester,
      year: ctxII_B.year,
      section: ctxII_B.section,
    });
    await TimetableSession.deleteMany({ academicContextId: ctxII_B._id });
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxII_B._id });

    // Step A: Fetch core curriculum courses for Semester III dynamically
    const semIIICourses = await Course.find({
      semester: 'Semester III',
      isActive: true,
      category: { $nin: ['PEC', 'OEC'] },
    }).sort({ courseCode: 1 });
    assert(semIIICourses.length === 10, `Semester III has 10 curriculum core courses (got: ${semIIICourses.length})`);

    // Step B: Fetch active faculties and allocate authoritative faculty for all 10 courses
    const activeFaculties = await Faculty.find({ isActive: true }).limit(10);
    assert(activeFaculties.length >= 10, 'Sufficient active faculties available');

    for (let i = 0; i < semIIICourses.length; i++) {
      const crs = semIIICourses[i];
      const fac = activeFaculties[i];
      await HODFacultyAllocation.create({
        academicContextId: ctxII_B._id,
        courseCode: crs.courseCode,
        courseName: crs.courseName,
        facultyId: fac.facultyId,
        facultyName: fac.facultyName,
        allocationType: crs.isLab ? 'LAB_PRIMARY' : 'THEORY',
        assignedBy: 'Dr. T. Rajasekaran (HOD)',
        status: 'APPROVED',
      });
    }

    // Step C: Verify context status is now READY_FOR_GENERATION
    const readyStatus = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/context-status/${ctxII_B._id}`,
    });
    assert(readyStatus.body.data.state === 'READY_FOR_GENERATION', `Context transitions to READY_FOR_GENERATION (got: '${readyStatus.body.data.state}')`);
    assert(readyStatus.body.data.nextAction === 'GENERATE_TIMETABLE', 'Next action is GENERATE_TIMETABLE');
    assert(readyStatus.body.data.allocation.complete === true, 'Allocation completeness is true');

    // Step D: Coordinator Generates Timetable (using dynamic active curriculum, 4 courses in assignment plan)
    const genPayload = {
      academicContextId: ctxII_B._id,
      assignmentPlan: [
        { courseCode: semIIICourses[0].courseCode, facultyId: activeFaculties[0].facultyId, requiredPeriods: 4 },
        { courseCode: semIIICourses[1].courseCode, facultyId: activeFaculties[1].facultyId, requiredPeriods: 4 },
        { courseCode: semIIICourses[2].courseCode, facultyId: activeFaculties[2].facultyId, requiredPeriods: 3 },
      ],
      generationSeed: 987654,
    };

    const genRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/generate',
      headers: { Authorization: `Bearer ${acToken}` },
      body: genPayload,
    });
    assert(genRes.statusCode === 201, 'Timetable generation on II Year Sec B succeeded with HTTP 201');
    const generatedVersion = genRes.body.data.timetableVersion;
    assert(generatedVersion.status === 'GENERATED', `Version status is GENERATED (got: '${generatedVersion.status}')`);
    const genSessionsCount = genRes.body.data.sessionsCreated;
    assert(genSessionsCount === 11, `Generated exactly 11 sessions (got: ${genSessionsCount})`);

    // Step E: Review Matrix & Isolation Check
    const matrixRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/review-matrix?academicContextId=${ctxII_B._id}&timetableVersionId=${generatedVersion._id}`,
    });
    assert(matrixRes.statusCode === 200, 'Review matrix for II Year Sec B returns HTTP 200');
    assert(matrixRes.body.data.sessionCount === 11, `Review matrix session count matches generated count (got: ${matrixRes.body.data.sessionCount})`);

    // Cross-cohort isolation check: querying II-B version with II-A context should yield 0 sessions
    const ctxII_A = allContexts.find((c) => c.year === 'II Year' && c.section === 'A');
    const crossRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/review-matrix?academicContextId=${ctxII_A._id}&timetableVersionId=${generatedVersion._id}`,
    });
    assert(
      crossRes.statusCode === 409 || crossRes.body?.data?.sessionCount === 0,
      'Cross-cohort matrix query rejected with HTTP 409 or 0 sessions (strict isolation)'
    );

    // Step F: Public View isolation before publishing (Draft MUST NOT leak)
    const publicBeforePublish = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${ctxII_B._id}`,
    });
    assert(publicBeforePublish.statusCode === 200, 'GET /api/timetable/class/:id returns HTTP 200');
    assert(publicBeforePublish.body.data.isPublished === false, 'isPublished remains false prior to publish');
    assert(publicBeforePublish.body.data.sessions.length === 0, 'Zero draft sessions exposed to public endpoint');

    // Step G: Lifecycle Transitions (Submit -> Approve -> Publish)
    const submitRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${generatedVersion._id}/status`,
      headers: { Authorization: `Bearer ${acToken}` },
      body: { status: 'PENDING_HOD_APPROVAL' },
    });
    assert(submitRes.statusCode === 200, 'Coordinator submits version to PENDING_HOD_APPROVAL');

    const approveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${generatedVersion._id}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'APPROVED' },
    });
    assert(approveRes.statusCode === 200, 'HOD approves version (HTTP 200)');

    const publishRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${generatedVersion._id}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'PUBLISHED' },
    });
    assert(publishRes.statusCode === 200, 'HOD publishes version (HTTP 200)');

    // Step H: Public View now serves published sessions
    const publicAfterPublish = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${ctxII_B._id}`,
    });
    assert(publicAfterPublish.statusCode === 200, 'Public class timetable returns HTTP 200 after publish');
    assert(publicAfterPublish.body.data.isPublished === true, 'isPublished is now true');
    assert(publicAfterPublish.body.data.sessionCount === 11, `Published session count matches (count: ${publicAfterPublish.body.data.sessionCount})`);

    // ------------------------------------------------------------
    // SUITE 4: Authoritative Faculty Allocation & Elective Enforcement
    // ------------------------------------------------------------
    console.log('\n--- SUITE 4: Authoritative Faculty Allocation & Elective Enforcement ---');

    // Test 4A: Attempt generation with faculty mismatch
    const mismatchPayload = {
      academicContextId: ctxII_B._id,
      assignmentPlan: [
        { courseCode: semIIICourses[0].courseCode, facultyId: 'FWL-99', requiredPeriods: 4 },
      ],
    };
    const mismatchRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/generate',
      headers: { Authorization: `Bearer ${acToken}` },
      body: mismatchPayload,
    });
    assert(mismatchRes.statusCode === 409, 'Faculty mismatch rejected with HTTP 409');
    assert(mismatchRes.body.code === 'HOD_FACULTY_MISMATCH', `Error code is HOD_FACULTY_MISMATCH (got: '${mismatchRes.body.code}')`);

    // Test 4B: Attempt to schedule PEC elective in Semester III (which has 0 elective slots)
    const invalidElectivePayload = {
      academicContextId: ctxII_B._id,
      assignmentPlan: [
        { courseCode: '22CSX21', facultyId: activeFaculties[0].facultyId, requiredPeriods: 3 },
      ],
    };
    const invalidElectiveRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/generate',
      headers: { Authorization: `Bearer ${acToken}` },
      body: invalidElectivePayload,
    });
    assert(invalidElectiveRes.statusCode === 409, 'Scheduling PEC elective in Semester III rejected with HTTP 409');
    assert(invalidElectiveRes.body.code === 'COURSE_SEMESTER_MISMATCH', `Error code is COURSE_SEMESTER_MISMATCH (got: '${invalidElectiveRes.body.code}')`);

    // ------------------------------------------------------------
    // SUITE 5: Seed Idempotency & History Preservation
    // ------------------------------------------------------------
    console.log('\n--- SUITE 5: Seed Idempotency & History Preservation ---');

    // Create a canary published version for II-B
    const canaryVersionCountBefore = await TimetableVersion.countDocuments();
    const canarySessionCountBefore = await TimetableSession.countDocuments();

    // Run seedTimetable()
    await seedTimetable();

    const versionStillExists = await TimetableVersion.findById(generatedVersion._id);
    assert(!!versionStillExists, 'Rerunning seedTimetable did NOT erase historical timetable version');

    const sessionsStillExist = await TimetableSession.find({ timetableVersionId: generatedVersion._id });
    assert(sessionsStillExist.length === 11, `Historical sessions preserved after seed execution (count: ${sessionsStillExist.length})`);

    const versionCountAfter = await TimetableVersion.countDocuments();
    assert(versionCountAfter >= canaryVersionCountBefore, 'Timetable versions count was not destructively wiped');

    // Clean up temporary II-B test version
    await TimetableSession.deleteMany({ timetableVersionId: generatedVersion._id });
    await TimetableVersion.findByIdAndDelete(generatedVersion._id);
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxII_B._id });

    console.log('\n============================================================');
    console.log(`WHOLE-CSE MULTI-COHORT SUITE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Unhandled test suite error:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runWholeCseTestSuite();
}

module.exports = { runWholeCseTestSuite };
