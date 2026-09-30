/**
 * Live End-to-End API Integration Journey (Section 27)
 * 
 * Executes a single, continuous live API integration journey through real HTTP requests:
 * 1. Authenticate as HOD (POST /api/auth/login)
 * 2. Resolve target AcademicContext for Odd Semester 2026-27 (GET /api/academic-contexts)
 * 3. Fetch official course set for the context's curriculum semester (GET /api/courses)
 * 4. Validate HOD allocations for the cohort (GET /api/hod-allocations/validate/:academicContextId)
 * 5. Ensure valid HOD allocations exist for the cohort courses
 * 6. Authenticate as Academic Coordinator (POST /api/auth/login)
 * 7. Generate timetable via CSP solver (POST /api/timetable/generate)
 * 8. Fetch Review Matrix (GET /api/timetable/review-matrix)
 * 9. Fetch Class timetable (GET /api/timetable/class/:academicContextId)
 * 10. Fetch Faculty timetable for assigned faculty (GET /api/timetable/faculty/:facultyId)
 * 11. Submit generated timetable for HOD approval (PATCH /api/timetable/version/:id/status)
 * 12. Authenticate as HOD and approve timetable (PATCH /api/timetable/version/:id/status)
 * 13. Publish timetable (PATCH /api/timetable/version/:id/status)
 * 14. Verify published class timetable serves approved timetable (GET /api/timetable/class/:academicContextId)
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');

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

async function runLiveJourney() {
  console.log('============================================================');
  console.log('STARTING SECTION 27: LIVE END-TO-END API INTEGRATION JOURNEY');
  console.log('============================================================\n');

  try {
    await connectDB();

    // ------------------------------------------------------------
    // STEP 1: Authenticate as HOD
    // ------------------------------------------------------------
    console.log('--- STEP 1: Authenticate as HOD ---');
    const hodLoginRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'hod@nec.edu.in', password: process.env.DEV_SEED_PASSWORD || 'Password123!' },
    });
    assert(hodLoginRes.statusCode === 200, 'POST /api/auth/login for HOD returns HTTP 200');
    assert(hodLoginRes.body.success === true, 'HOD login success is true');
    const hodToken = hodLoginRes.body.data.token;
    assert(typeof hodToken === 'string' && hodToken.length > 20, 'HOD JWT token obtained');
    const hodUser = hodLoginRes.body.data.user;
    assert(hodUser.role === 'HOD', `HOD role verified (got: '${hodUser.role}')`);

    // ------------------------------------------------------------
    // STEP 2: Resolve Target AcademicContext
    // ------------------------------------------------------------
    console.log('\n--- STEP 2: Resolve Target AcademicContext ---');
    const ctxRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/academic-contexts?academicYear=2026-27&semester=Odd%20Semester&department=CSE&status=ACTIVE',
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(ctxRes.statusCode === 200, 'GET /api/academic-contexts returns HTTP 200');
    const contexts = ctxRes.body.data || [];
    assert(contexts.length === 12, `12 active CSE contexts found (got: ${contexts.length})`);
    
    // Select III Year Section B for the live pipeline journey
    const targetContext = contexts.find(c => c.year === 'III Year' && c.section === 'B');
    assert(targetContext !== undefined, 'Target context (III Year Sec B) successfully resolved');
    console.log(`  Selected Context ID: ${targetContext._id} (${targetContext.year} Sec ${targetContext.section})`);

    // ------------------------------------------------------------
    // STEP 3: Fetch Official Course Set for Context Curriculum Semester
    // ------------------------------------------------------------
    console.log('\n--- STEP 3: Fetch Official Course Set for Semester V ---');
    const coursesRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/courses?semester=Semester%20V',
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(coursesRes.statusCode === 200, 'GET /api/courses?semester=Semester V returns HTTP 200');
    const semCourses = (coursesRes.body.data && coursesRes.body.data.items) || [];
    assert(semCourses.length === 6, `Semester V returns exactly 6 core courses (got: ${semCourses.length})`);
    const expectedCodes = ['22CSC14', '22CSC15', '22CSC16', '22CSP09', '22CSP10', '22MAN8R'];
    const codes = semCourses.map(c => c.courseCode).sort();
    assert(JSON.stringify(codes) === JSON.stringify(expectedCodes), `Semester V course codes match R22 standard: ${codes.join(', ')}`);

    // ------------------------------------------------------------
    // STEP 4: Validate HOD Allocations for the Cohort
    // ------------------------------------------------------------
    console.log('\n--- STEP 4: Validate HOD Allocations for the Cohort ---');
    const valRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod-allocations/validate/${targetContext._id}`,
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(valRes.statusCode === 200, 'GET /api/hod-allocations/validate/:id returns HTTP 200');
    assert(valRes.body.success === true, 'Validation response success is true');
    console.log(`  Initial Cohort Allocations: ready=${valRes.body.data.readyForGeneration}, allocated=${valRes.body.data.allocatedCount}/${valRes.body.data.totalRequiredCourses}`);

    // ------------------------------------------------------------
    // STEP 5: Ensure Authoritative HOD Allocations for All Required Courses
    // ------------------------------------------------------------
    console.log('\n--- STEP 5: Ensure Authoritative HOD Allocations ---');
    // Query active faculty
    const facRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/faculty?isActive=true&limit=10',
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    const facultyList = (facRes.body.data && (facRes.body.data.faculty || facRes.body.data.items)) || [];
    assert(facultyList.length >= 6, 'Sufficient active faculty found in directory');

    // Create allocations for all 6 core courses dynamically (supporting LAB multi-faculty and SAS dual roles)
    const facultyMap = {
      '22CSC14': { facultyId: 'FWL-04', assignments: [{ facultyId: 'FWL-04', role: 'THEORY' }] },
      '22CSC15': { facultyId: 'FWL-05', assignments: [{ facultyId: 'FWL-05', role: 'THEORY' }] },
      '22CSC16': { facultyId: 'FWL-06', assignments: [{ facultyId: 'FWL-06', role: 'THEORY' }] },
      '22CSP09': {
        facultyId: 'FWL-05',
        rule: 'LAB_2_TO_3',
        assignments: [
          { facultyId: 'FWL-05', role: 'PRIMARY' },
          { facultyId: 'FWL-14', role: 'ADDITIONAL' },
        ],
      },
      '22CSP10': {
        facultyId: 'FWL-06',
        rule: 'LAB_2_TO_3',
        assignments: [
          { facultyId: 'FWL-06', role: 'PRIMARY' },
          { facultyId: 'FWL-15', role: 'ADDITIONAL' },
        ],
      },
      '22MAN8R': {
        facultyId: 'FWL-01',
        rule: 'MC_SAS',
        assignments: [
          { facultyId: 'FWL-01', role: 'MATHS_BME' },
          { facultyId: 'FWL-02', role: 'ENGLISH' },
        ],
      },
    };

    const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
    for (const [courseCode, config] of Object.entries(facultyMap)) {
      const isLab = courseCode.includes('P');
      const isSas = courseCode === '22MAN8R';
      const assignments = config.assignments.map((a) => {
        const fac = facultyList.find((f) => f.facultyId === a.facultyId);
        return {
          facultyId: a.facultyId,
          facultyName: fac?.facultyName || a.facultyId,
          role: a.role,
          required: a.role !== 'OPTIONAL',
          source: a.role === 'PRIMARY' ? 'THEORY_LINKED' : 'MANUAL',
        };
      });

      await HODFacultyAllocation.findOneAndUpdate(
        { academicContextId: targetContext._id, courseCode },
        {
          $set: {
            academicContextId: targetContext._id,
            courseCode,
            courseName: semCourses.find((c) => c.courseCode === courseCode)?.courseName || courseCode,
            facultyId: config.facultyId,
            facultyName: facultyList.find((f) => f.facultyId === config.facultyId)?.facultyName || config.facultyId,
            allocationRule: config.rule || (isLab ? 'LAB_2_TO_3' : isSas ? 'MC_SAS' : 'THEORY_SINGLE'),
            allocationType: isLab ? 'LAB_PRIMARY' : isSas ? 'SAS' : 'THEORY',
            facultyAssignments: assignments,
            status: 'APPROVED',
            assignedBy: 'HOD',
          },
        },
        { upsert: true, new: true }
      );
    }

    const revalRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod-allocations/validate/${targetContext._id}`,
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(revalRes.body.data.readyForGeneration === true, 'Cohort allocations are 100% complete and ready for generation');
    assert(revalRes.body.data.allocatedCount === 6, 'All 6 Semester V core courses allocated');

    // ------------------------------------------------------------
    // STEP 6: Authenticate as Academic Coordinator
    // ------------------------------------------------------------
    console.log('\n--- STEP 6: Authenticate as Academic Coordinator ---');
    const acLoginRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'ac@nec.edu.in', password: process.env.DEV_SEED_PASSWORD || 'Password123!' },
    });
    assert(acLoginRes.statusCode === 200, 'POST /api/auth/login for AC returns HTTP 200');
    const acToken = acLoginRes.body.data.token;
    assert(typeof acToken === 'string' && acToken.length > 20, 'AC JWT token obtained');
    const acUser = acLoginRes.body.data.user;
    assert(acUser.role === 'AC', `AC role verified (got: '${acUser.role}')`);

    // ------------------------------------------------------------
    // STEP 7: Generate Timetable via CSP Solver (Dynamic Assignment Plan)
    // ------------------------------------------------------------
    console.log('\n--- STEP 7: Generate Timetable via CSP Solver (Dynamic Active Set) ---');
    // Dynamically retrieve the authoritative allocations to construct assignmentPlan
    const activeAllocations = await HODFacultyAllocation.find({
      academicContextId: targetContext._id,
      status: 'APPROVED',
    }).sort({ courseCode: 1 });

    const dynamicAssignmentPlan = activeAllocations.map((a) => {
      const crs = semCourses.find((c) => c.courseCode === a.courseCode);
      return {
        courseCode: a.courseCode,
        facultyId: a.facultyId,
        requiredPeriods: crs && crs.totalPeriod ? crs.totalPeriod : 4,
      };
    });

    const expectedTotalSessions = dynamicAssignmentPlan.reduce((sum, item) => sum + item.requiredPeriods, 0);

    const genRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/generate',
      headers: { Authorization: `Bearer ${acToken}` },
      body: {
        academicContextId: targetContext._id,
        assignmentPlan: dynamicAssignmentPlan,
        generationSeed: 123456,
      },
    });
    assert(genRes.statusCode === 201, 'POST /api/timetable/generate returns HTTP 201');
    assert(genRes.body.success === true, 'Timetable generation response success is true');
    const liveVersion = genRes.body.data.timetableVersion;
    assert(liveVersion && liveVersion._id, 'Generation created a TimetableVersion record');
    assert(liveVersion.status === 'GENERATED', `Generated version status is 'GENERATED' (got: '${liveVersion.status}')`);
    const sessionsCreated = genRes.body.data.sessionsCreated;
    assert(sessionsCreated === expectedTotalSessions, `Total ${expectedTotalSessions} sessions created for dynamic active course set (got: ${sessionsCreated})`);

    // ------------------------------------------------------------
    // STEP 8: Fetch Review Matrix
    // ------------------------------------------------------------
    console.log('\n--- STEP 8: Fetch Review Matrix ---');
    const matrixRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/review-matrix?academicContextId=${targetContext._id}&versionId=${liveVersion._id}`,
      headers: { Authorization: `Bearer ${acToken}` },
    });
    assert(matrixRes.statusCode === 200, 'GET /api/timetable/review-matrix returns HTTP 200');
    assert(matrixRes.body.data.sessionCount === expectedTotalSessions, `Review matrix returns exact generated session count ${expectedTotalSessions} (got: ${matrixRes.body.data.sessionCount})`);
    assert(matrixRes.body.data.academicContext.section === 'B', 'Review matrix maps to Section B');

    // ------------------------------------------------------------
    // STEP 9: Fetch Class Timetable (Internal View with Version ID)
    // ------------------------------------------------------------
    console.log('\n--- STEP 9: Fetch Class Timetable ---');
    const classRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${targetContext._id}?versionId=${liveVersion._id}`,
      headers: { Authorization: `Bearer ${acToken}` },
    });
    assert(classRes.statusCode === 200, 'GET /api/timetable/class/:academicContextId returns HTTP 200');
    assert(classRes.body.data.sessionCount === expectedTotalSessions, `Class timetable returns ${expectedTotalSessions} sessions`);

    // ------------------------------------------------------------
    // STEP 10: Fetch Faculty Timetable for Assigned Faculty
    // ------------------------------------------------------------
    console.log('\n--- STEP 10: Fetch Faculty Timetable for Assigned Faculty ---');
    const facSchedRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/FWL-04',
      headers: { Authorization: `Bearer ${acToken}` },
    });
    assert(facSchedRes.statusCode === 200, 'GET /api/timetable/faculty/FWL-04 returns HTTP 200');
    assert(facSchedRes.body.success === true, 'Faculty timetable response success is true');

    // ------------------------------------------------------------
    // STEP 11: Submit Generated Timetable for HOD Approval
    // ------------------------------------------------------------
    console.log('\n--- STEP 11: Submit Generated Timetable for HOD Approval ---');
    const submitRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${liveVersion._id}/status`,
      headers: { Authorization: `Bearer ${acToken}` },
      body: { status: 'PENDING_HOD_APPROVAL' },
    });
    assert(submitRes.statusCode === 200, 'Coordinator submits timetable (HTTP 200)');
    assert(submitRes.body.data.status === 'PENDING_HOD_APPROVAL', 'Timetable status is PENDING_HOD_APPROVAL');

    // ------------------------------------------------------------
    // STEP 12: Authenticate as HOD and Approve Timetable
    // ------------------------------------------------------------
    console.log('\n--- STEP 12: Authenticate as HOD and Approve Timetable ---');
    const approveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${liveVersion._id}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'APPROVED' },
    });
    assert(approveRes.statusCode === 200, 'HOD approves timetable (HTTP 200)');
    assert(approveRes.body.data.status === 'APPROVED', 'Timetable status is APPROVED');

    // ------------------------------------------------------------
    // STEP 13: Publish Timetable
    // ------------------------------------------------------------
    console.log('\n--- STEP 13: Publish Timetable ---');
    const publishRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${liveVersion._id}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'PUBLISHED' },
    });
    assert(publishRes.statusCode === 200, 'HOD publishes timetable (HTTP 200)');
    assert(publishRes.body.data.status === 'PUBLISHED', 'Timetable status is PUBLISHED');

    // ------------------------------------------------------------
    // STEP 14: Verify Published Class Timetable Serves Approved Timetable
    // ------------------------------------------------------------
    console.log('\n--- STEP 14: Verify Published Class Timetable ---');
    const pubRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${targetContext._id}`,
    });
    assert(pubRes.statusCode === 200, 'GET /api/timetable/class/:id (published) returns HTTP 200');
    assert(pubRes.body.data.sessionCount === expectedTotalSessions, `Default public class timetable now serves ${expectedTotalSessions} sessions (got: ${pubRes.body.data.sessionCount})`);
    const finalSessions = pubRes.body.data.sessions || [];
    const allMatchVersion = finalSessions.every((s) => s.timetableVersionId === liveVersion._id.toString());
    assert(allMatchVersion, 'All public class sessions belong to the approved & published timetable version');

    console.log('\n============================================================');
    console.log(`SECTION 27 LIVE JOURNEY COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================');

    await disconnectDB();

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during live journey:', err);
    await disconnectDB().catch(() => {});
    process.exit(1);
  }
}

runLiveJourney();
