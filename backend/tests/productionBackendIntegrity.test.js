/**
 * Production Backend Data Integrity & Pipeline Test Suite
 * 
 * Verifies the 10 Master Data Integrity Areas:
 * Area A: Course Identity & Canonical Naming (R22 curriculum, zero suffixes, L-T-P attributes)
 * Area B: Academic Context Isolation (12 target cohorts, zero cross-cohort leakage)
 * Area C: Elective Architecture (catalog vs explicit assignmentPlan, no auto-scheduling of unselected electives)
 * Area D: HOD Allocation & Validation (create, 409 conflict, 409 semester mismatch, cohort validation endpoint)
 * Area E: Timetable Generation (CSP engine, prerequisite check, session persistence)
 * Area F: TimetableSession Canonical Identity (courseCode, courseName, facultyId, versionId, period, day)
 * Area G: Review Matrix API (/api/timetable/review-matrix & /matrix, version isolation, session list)
 * Area H: Faculty & Class Timetable Isolation (zero historical leakage, active/published version filtering)
 * Area I: Approval Workflow & RBAC (GENERATED -> PENDING_HOD_APPROVAL -> APPROVED -> PUBLISHED, role enforcement)
 * Area J: Regulation API (/api/regulation/current, /api/regulations)
 */

require('dotenv').config();
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
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const { generateToken } = require('../src/utils/generateToken');
const { buildSchedulingContext } = require('../src/services/timetable/constraintBuilder');

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

async function runIntegrityTests() {
  console.log('============================================================');
  console.log('MASTER PRODUCTION BACKEND INTEGRITY & PIPELINE TEST SUITE');
  console.log('============================================================');

  try {
    await connectDB();

    // Setup Test Users
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Password@123', salt);

    const usersData = [
      { name: 'Integrity HOD', email: 'integ_hod@nec.edu.in', passwordHash: hash, role: 'HOD', isActive: true },
      { name: 'Integrity Coord', email: 'integ_coord@nec.edu.in', passwordHash: hash, role: 'AC', isActive: true },
      { name: 'Integrity Faculty', email: 'integ_fac@nec.edu.in', passwordHash: hash, role: 'FACULTY', isActive: true },
    ];

    for (const u of usersData) {
      await User.findOneAndUpdate({ email: u.email }, { $set: u }, { upsert: true });
    }

    const hodUser = await User.findOne({ email: 'integ_hod@nec.edu.in' });
    const acUser = await User.findOne({ email: 'integ_coord@nec.edu.in' });
    const facUser = await User.findOne({ email: 'integ_fac@nec.edu.in' });

    const hodToken = generateToken(hodUser);
    const acToken = generateToken(acUser);
    const facToken = generateToken(facUser);

    // ============================================================
    // AREA A: COURSE IDENTITY & CANONICAL NAMING
    // ============================================================
    console.log('\n--- AREA A: Course Identity & Canonical Naming ---');
    const r22Courses = await Course.find({ isR22UG: true });
    assert(r22Courses.length === 109, `R22 curriculum contains exactly 109 courses (got: ${r22Courses.length})`);

    // Check zero presentation suffixes across all courses
    const suffixCount = await Course.countDocuments({
      courseName: { $regex: /\((PSE|PBL)\)/i },
    });
    assert(suffixCount === 0, `Zero courses contain presentation suffixes (PSE) or (PBL) (got: ${suffixCount})`);

    // Check canonical semester strings
    const allowedSemesters = [
      'Semester I', 'Semester II', 'Semester III', 'Semester IV',
      'Semester V', 'Semester VI', 'Semester VII', 'Semester VIII',
      'Programme Elective', 'Open Elective'
    ];
    const invalidSemCourses = await Course.find({ isR22UG: true, semester: { $nin: allowedSemesters } });
    assert(invalidSemCourses.length === 0, `All R22 courses have canonical semester strings (invalid: ${invalidSemCourses.length})`);

    // Check critical course attributes
    const ged01 = await Course.findOne({ courseCode: '22GED01' });
    assert(ged01 && ged01.totalPeriod === 0, '22GED01 (Soft Skills) correctly has totalPeriod = 0');
    assert(ged01 && ged01.L === 0 && ged01.T === 0 && ged01.P === 0, '22GED01 has L-T-P = 0-0-0');

    const csd01 = await Course.findOne({ courseCode: '22CSD01' });
    assert(csd01 && csd01.totalPeriod === 20, '22CSD01 (Project Work) has totalPeriod = 20');
    assert(csd01 && csd01.P === 20, '22CSD01 has P = 20');

    const gea01 = await Course.findOne({ courseCode: '22GEA01' });
    assert(gea01 && gea01.semester === 'Semester VII', '22GEA01 (UHV) is in Semester VII');
    assert(gea01 && gea01.courseName === 'Universal Human Values', '22GEA01 is named Universal Human Values');

    const csc15 = await Course.findOne({ courseCode: '22CSC15' });
    assert(csc15 && csc15.courseName === 'Full Stack Development', `22CSC15 is named 'Full Stack Development' without suffix (got: '${csc15?.courseName}')`);

    const csx42 = await Course.findOne({ courseCode: '22CSX42' });
    assert(csx42 && csx42.courseName === 'UI and UX Design', `22CSX42 is named 'UI and UX Design' without suffix (got: '${csx42?.courseName}')`);

    const csx21 = await Course.findOne({ courseCode: '22CSX21' });
    assert(csx21 && csx21.courseName === 'Fundamentals of Cryptography and Network Security', `22CSX21 is named 'Fundamentals of Cryptography and Network Security' without suffix (got: '${csx21?.courseName}')`);

    // ============================================================
    // AREA B: ACADEMIC CONTEXT ISOLATION
    // ============================================================
    console.log('\n--- AREA B: Academic Context Isolation ---');
    const targetContexts = await AcademicContext.find({
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      status: 'ACTIVE',
    });
    assert(targetContexts.length === 12, `Exactly 12 active CSE target cohorts exist for 2026-27 Odd Semester (got: ${targetContexts.length})`);

    const iiSections = targetContexts.filter(c => c.year === 'II Year').map(c => c.section).sort();
    const iiiSections = targetContexts.filter(c => c.year === 'III Year').map(c => c.section).sort();
    const ivSections = targetContexts.filter(c => c.year === 'IV Year').map(c => c.section).sort();
    assert(JSON.stringify(iiSections) === JSON.stringify(['A', 'B', 'C', 'D']), 'II Year has sections A, B, C, D');
    assert(JSON.stringify(iiiSections) === JSON.stringify(['A', 'B', 'C', 'D']), 'III Year has sections A, B, C, D');
    assert(JSON.stringify(ivSections) === JSON.stringify(['A', 'B', 'C', 'D']), 'IV Year has sections A, B, C, D');

    // Context Isolation Test: Context A vs Context B
    const ctxA = targetContexts.find(c => c.year === 'III Year' && c.section === 'A');
    const ctxB = targetContexts.find(c => c.year === 'III Year' && c.section === 'B');
    assert(ctxA && ctxB && ctxA._id.toString() !== ctxB._id.toString(), 'Context A and Context B have distinct ObjectIds');

    // ============================================================
    // AREA C: ELECTIVE ARCHITECTURE
    // ============================================================
    console.log('\n--- AREA C: Elective Architecture ---');
    const pecCount = await Course.countDocuments({ isR22UG: true, category: 'PEC' });
    const oecCount = await Course.countDocuments({ isR22UG: true, category: 'OEC' });
    assert(pecCount === 48, `PEC Elective catalog contains exactly 48 courses in Course master (count: ${pecCount})`);
    assert(oecCount === 2, `OEC Elective catalog contains exactly 2 courses in Course master (count: ${oecCount})`);

    // Verify unselected electives are not automatically scheduled when assignmentPlan has core courses only
    const schedulingContext = await buildSchedulingContext({
      academicContextId: ctxA._id.toString(),
      assignmentPlan: [
        { courseCode: '22CSC14', facultyId: 'FWL-04', requiredPeriods: 4 },
        { courseCode: '22CSP09', facultyId: 'FWL-14', requiredPeriods: 4 },
      ],
    });
    const scheduledCodes = schedulingContext.allVariables.map(v => v.courseCode);
    const hasUnselectedPec = scheduledCodes.some(code => ['22CSX42', '22CSX21', '22CSX01'].includes(code));
    assert(!hasUnselectedPec, 'Scheduling context excludes unselected PEC electives');

    // Verify HOD allocation enforcement rejects unauthorized faculty overrides
    let mismatchCaught = false;
    try {
      await buildSchedulingContext({
        academicContextId: ctxA._id.toString(),
        assignmentPlan: [
          { courseCode: '22CSC14', facultyId: 'FWL-99', requiredPeriods: 4 },
        ],
      });
    } catch (err) {
      if (err.code === 'HOD_FACULTY_MISMATCH') {
        mismatchCaught = true;
      }
    }
    assert(mismatchCaught, 'Constraint builder strictly enforces authoritative HOD faculty allocation (rejects mismatch)');

    // ============================================================
    // AREA D: HOD ALLOCATION & VALIDATION
    // ============================================================
    console.log('\n--- AREA D: HOD Allocation & Validation ---');
    // Test 1: Cohort validation endpoint
    const valRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/hod-allocations/validate/${ctxA._id}`,
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(valRes.statusCode === 200, 'GET /api/hod-allocations/validate/:academicContextId returns HTTP 200');
    assert(valRes.body.success === true, 'Cohort validation response success is true');
    assert(typeof valRes.body.data.readyForGeneration === 'boolean', 'Cohort validation returns readyForGeneration boolean');
    assert(valRes.body.data.totalRequiredCourses > 0, `Cohort validation reports totalRequiredCourses (got: ${valRes.body.data.totalRequiredCourses})`);

    // Test 2: Create allocation with canonical course name enforcement
    const testFac = await Faculty.findOne({ isActive: true });
    assert(testFac !== null, 'Found an active faculty for allocation test');

    // Clean up any test allocation for 22CSC14 in ctxB
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxB._id, courseCode: '22CSC14' });

    const createAllocRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/hod-allocations',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        academicContextId: ctxB._id.toString(),
        courseCode: '22CSC14',
        facultyId: testFac.facultyId,
        allocationType: 'THEORY',
      },
    });
    assert(createAllocRes.statusCode === 201, 'POST /api/hod-allocations creates allocation with HTTP 201');
    assert(createAllocRes.body.data.courseName === 'Principles of Compiler Design', 'Allocation enforces canonical courseName from Course Master');

    // Test 3: Conflict 409 on duplicate allocation
    const dupAllocRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/hod-allocations',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        academicContextId: ctxB._id.toString(),
        courseCode: '22CSC14',
        facultyId: testFac.facultyId,
      },
    });
    assert(dupAllocRes.statusCode === 409, 'Duplicate active allocation is rejected with HTTP 409 conflict');

    // Test 4: Semester mismatch rejection (Sem III course to Sem V context)
    const mismatchRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/hod-allocations',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: {
        academicContextId: ctxB._id.toString(), // III Year = Semester V
        courseCode: '22CSC05', // Algorithms is Semester III
        facultyId: testFac.facultyId,
      },
    });
    assert(mismatchRes.statusCode === 409, 'Allocating course from mismatched semester returns HTTP 409 COURSE_SEMESTER_MISMATCH');

    // Clean up test allocation
    await HODFacultyAllocation.deleteMany({ academicContextId: ctxB._id, courseCode: '22CSC14' });

    // ============================================================
    // AREA E: TIMETABLE GENERATION (CSP ENGINE)
    // ============================================================
    console.log('\n--- AREA E: Timetable Generation (CSP Engine) ---');
    const genPayload = {
      academicContextId: ctxA._id.toString(),
      assignmentPlan: [
        { courseCode: '22CSC14', facultyId: 'FWL-04', requiredPeriods: 4 },
        { courseCode: '22CSP09', facultyId: 'FWL-14', requiredPeriods: 4 },
      ],
      generationSeed: 998877,
    };

    const genRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/generate',
      headers: { Authorization: `Bearer ${acToken}` },
      body: genPayload,
    });
    assert(genRes.statusCode === 201, `POST /api/timetable/generate returns HTTP 201 (got: ${genRes.statusCode})`);
    assert(genRes.body.success === true, 'Timetable generation response success is true');
    const generatedVersion = genRes.body.data.timetableVersion;
    assert(generatedVersion && generatedVersion._id, 'Generation created a TimetableVersion record');
    assert(generatedVersion.status === 'GENERATED', `Generated version has status 'GENERATED' (got: '${generatedVersion.status}')`);
    assert(genRes.body.data.sessionsCreated === 8, `Generation created 8 sessions (got: ${genRes.body.data.sessionsCreated})`);

    // ============================================================
    // AREA F: TIMETABLESESSIONS CANONICAL IDENTITY
    // ============================================================
    console.log('\n--- AREA F: TimetableSessions Canonical Identity ---');
    const sessions = await TimetableSession.find({ timetableVersionId: generatedVersion._id });
    assert(sessions.length === 8, `Persisted sessions strictly match generated count 8 (got: ${sessions.length})`);

    const hasSuffix = sessions.some(s => s.courseName.includes('(PSE)') || s.courseName.includes('(PBL)'));
    assert(!hasSuffix, 'Zero generated TimetableSession records contain presentation suffixes (PSE) or (PBL)');

    const validDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const invalidDaySessions = sessions.filter(s => !validDays.includes(s.day));
    assert(invalidDaySessions.length === 0, 'All sessions have canonical day strings (MON..FRI)');

    const invalidPeriods = sessions.filter(s => !/^P[1-8]$/.test(s.period));
    assert(invalidPeriods.length === 0, 'All sessions have periods in valid range P1..P8');

    // Check canonical course names on persisted sessions
    const csc14Session = sessions.find(s => s.courseCode === '22CSC14');
    assert(csc14Session && csc14Session.courseName === 'Principles of Compiler Design', 'Session for 22CSC14 has canonical courseName');

    // ============================================================
    // AREA G: REVIEW MATRIX API
    // ============================================================
    console.log('\n--- AREA G: Review Matrix API ---');
    const matrixRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/review-matrix?academicContextId=${ctxA._id}&versionId=${generatedVersion._id}`,
      headers: { Authorization: `Bearer ${acToken}` },
    });
    assert(matrixRes.statusCode === 200, 'GET /api/timetable/review-matrix returns HTTP 200');
    assert(matrixRes.body.success === true, 'Review matrix response success is true');
    assert(Array.isArray(matrixRes.body.data.sessions), 'Review matrix returns sessions array');
    assert(matrixRes.body.data.sessionCount === 8, `Review matrix sessionCount is 8 (got: ${matrixRes.body.data.sessionCount})`);
    assert(matrixRes.body.data.timetableVersionId === generatedVersion._id.toString(), 'Review matrix matches requested versionId');

    // Verify alias /api/timetable/matrix
    const aliasRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/matrix?academicContextId=${ctxA._id}&versionId=${generatedVersion._id}`,
      headers: { Authorization: `Bearer ${acToken}` },
    });
    assert(aliasRes.statusCode === 200, 'Alias GET /api/timetable/matrix returns HTTP 200');
    assert(aliasRes.body.data.sessionCount === 8, 'Alias matrix returns identical session count');

    // Historical / Non-existent version isolation: returns 404 NOT_FOUND
    const dummyVersionId = new mongoose.Types.ObjectId();
    const isoMatrixRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/review-matrix?academicContextId=${ctxA._id}&versionId=${dummyVersionId}`,
      headers: { Authorization: `Bearer ${acToken}` },
    });
    assert(isoMatrixRes.statusCode === 404, 'Review matrix with non-existent versionId returns HTTP 404');
    assert(isoMatrixRes.body.code === 'NOT_FOUND', 'Response code is NOT_FOUND');

    // Cross-cohort version isolation: Querying context B with version generated for context A returns 0 sessions
    const crossCohortMatrixRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/review-matrix?academicContextId=${ctxB._id}&versionId=${generatedVersion._id}`,
      headers: { Authorization: `Bearer ${acToken}` },
    });
    assert(crossCohortMatrixRes.statusCode === 200, 'Cross-cohort review matrix returns HTTP 200');
    assert(crossCohortMatrixRes.body.data.sessionCount === 0, 'Cross-cohort review matrix returns 0 sessions (strict isolation)');

    // ============================================================
    // AREA H: FACULTY & CLASS TIMETABLE ISOLATION
    // ============================================================
    console.log('\n--- AREA H: Faculty & Class Timetable Isolation ---');
    // When versionId omitted, getClassTimetable returns published/active version only
    const classRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${ctxA._id}`,
    });
    assert(classRes.statusCode === 200, 'GET /api/timetable/class/:academicContextId returns HTTP 200');
    // Notice: our newly generated version is GENERATED, not yet PUBLISHED.
    // Ensure draft GENERATED sessions do not leak into default published class view!
    const classSessions = classRes.body.data.sessions || [];
    const draftLeaked = classSessions.some(s => s.timetableVersionId === generatedVersion._id.toString());
    assert(!draftLeaked, 'Draft GENERATED version does NOT leak into default public class schedule');

    // Check Faculty Timetable Isolation
    const facScheduleRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/timetable/faculty/FWL-04',
    });
    assert(facScheduleRes.statusCode === 200, 'GET /api/timetable/faculty/:facultyId returns HTTP 200');
    const facSessions = facScheduleRes.body.data.sessions || [];
    const foreignFacultySessions = facSessions.filter(s => s.facultyId !== 'FWL-04');
    assert(foreignFacultySessions.length === 0, 'Faculty schedule contains strictly sessions belonging to requested facultyId');

    // ============================================================
    // AREA I: APPROVAL WORKFLOW & RBAC AUTHORIZATION
    // ============================================================
    console.log('\n--- AREA I: Approval Workflow & RBAC Authorization ---');
    // Test 1: FACULTY role cannot generate or transition status (403)
    const facSolveRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/timetable/generate',
      headers: { Authorization: `Bearer ${facToken}` },
      body: genPayload,
    });
    assert(facSolveRes.statusCode === 403, 'FACULTY role is forbidden from generating timetable (HTTP 403)');

    // Test 2: Coordinator transitions GENERATED -> PENDING_HOD_APPROVAL
    const submitRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${generatedVersion._id}/status`,
      headers: { Authorization: `Bearer ${acToken}` },
      body: { status: 'PENDING_HOD_APPROVAL' },
    });
    assert(submitRes.statusCode === 200, 'Coordinator transitions version to PENDING_HOD_APPROVAL (HTTP 200)');
    assert(submitRes.body.data.status === 'PENDING_HOD_APPROVAL', 'Version status is now PENDING_HOD_APPROVAL');

    // Test 3: Coordinator CANNOT approve timetable (403)
    const coordApproveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${generatedVersion._id}/status`,
      headers: { Authorization: `Bearer ${acToken}` },
      body: { status: 'APPROVED' },
    });
    assert(coordApproveRes.statusCode === 403, 'Coordinator cannot approve timetable (HTTP 403)');

    // Test 4: HOD approves timetable
    const hodApproveRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${generatedVersion._id}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'APPROVED' },
    });
    assert(hodApproveRes.statusCode === 200, 'HOD approves timetable (HTTP 200)');
    assert(hodApproveRes.body.data.status === 'APPROVED', 'Version status is now APPROVED');

    // Test 5: HOD publishes timetable
    const hodPublishRes = await makeRequest(app, {
      method: 'PATCH',
      path: `/api/timetable/version/${generatedVersion._id}/status`,
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { status: 'PUBLISHED' },
    });
    assert(hodPublishRes.statusCode === 200, 'HOD publishes timetable (HTTP 200)');
    assert(hodPublishRes.body.data.status === 'PUBLISHED', 'Version status is now PUBLISHED');

    // Test 6: Published version now appears in default public class schedule
    const pubClassRes = await makeRequest(app, {
      method: 'GET',
      path: `/api/timetable/class/${ctxA._id}`,
    });
    const pubClassSessions = pubClassRes.body.data.sessions || [];
    assert(pubClassSessions.length > 0, `Published version sessions now populate default class schedule (count: ${pubClassSessions.length})`);

    // ============================================================
    // AREA J: REGULATION API
    // ============================================================
    console.log('\n--- AREA J: Regulation API ---');
    const curRegRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/regulation/current',
    });
    assert(curRegRes.statusCode === 200, 'GET /api/regulation/current returns HTTP 200');
    assert(curRegRes.body.data.regulationCode === 'R22', `Current regulation is R22 (got: '${curRegRes.body.data.regulationCode}')`);
    assert(curRegRes.body.data.curriculumCode === 'R22-CSE', `Current curriculum is R22-CSE (got: '${curRegRes.body.data.curriculumCode}')`);
    assert(curRegRes.body.data.totalCourses === 109, `R22 regulation has 109 courses (got: ${curRegRes.body.data.totalCourses})`);

    const allRegRes = await makeRequest(app, {
      method: 'GET',
      path: '/api/regulations',
    });
    assert(allRegRes.statusCode === 200, 'GET /api/regulations returns HTTP 200');
    assert(Array.isArray(allRegRes.body.data), 'GET /api/regulations returns an array of regulations');
    const hasR22 = allRegRes.body.data.some(r => r.regulationCode === 'R22');
    assert(hasR22, 'Regulations array contains R22 regulation');

    console.log('\n============================================================');
    console.log(`PRODUCTION BACKEND INTEGRITY TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================');

    await disconnectDB();

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during integrity tests:', err);
    await disconnectDB().catch(() => {});
    process.exit(1);
  }
}

runIntegrityTests();
