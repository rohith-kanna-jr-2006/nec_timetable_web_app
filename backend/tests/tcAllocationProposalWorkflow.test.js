/**
 * TC Allocation Proposal & HOD Review Workflow Test Suite
 *
 * Verifies the TC operational faculty assignment workflow:
 *
 * 1. TC authentication
 * 2. TC can create assignment/proposal
 * 3. TC can save THEORY assignment
 * 4. TC can save LAB PRIMARY
 * 5. TC can save LAB ADDITIONAL
 * 6. TC can save LAB OPTIONAL
 * 7. TC can save PG assignment
 * 8. academicContextId isolation
 * 9. Theory max-2 rejection
 * 10. Lab max-2 rejection
 * 11. PG max-1 rejection
 * 12. TC cannot mutate approved HOD allocation directly
 * 13. HOD can review
 * 14. HOD can approve
 * 15. approval updates authoritative allocation
 * 16. HOD can reject with remarks
 * 17. rejected proposal can be revised
 * 18. revised proposal can be resubmitted
 * 19. unapproved proposal is not used for generation
 * 20. approved allocation is used by generateFromContext
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
const Course = require('../src/models/Course');
const AcademicContext = require('../src/models/AcademicContext');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const TCAllocationProposal = require('../src/models/TCAllocationProposal');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const { generateToken } = require('../src/utils/generateToken');
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
  console.log('TC ALLOCATION PROPOSAL & HOD WORKFLOW TEST SUITE');
  console.log('============================================================\n');

  await connectDB();

  // Clean any leftover temporary test courses from earlier runs
  await Course.deleteMany({ courseCode: /^TEMP_/ });

  const TEST_PREFIX = 'TC_PROP_TEST_';
  const tcEmail = `${TEST_PREFIX}tc@nec.edu.in`.toLowerCase();
  const hodEmail = `${TEST_PREFIX}hod@nec.edu.in`.toLowerCase();
  const password = 'TestPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);

  // Setup test users
  await User.findOneAndUpdate(
    { email: tcEmail },
    { $set: { name: 'Test TC Coordinator', email: tcEmail, passwordHash, role: 'TC', isActive: true } },
    { upsert: true }
  );
  await User.findOneAndUpdate(
    { email: hodEmail },
    { $set: { name: 'Test HOD', email: hodEmail, passwordHash, role: 'HOD', isActive: true } },
    { upsert: true }
  );

  const tcUser = await User.findOne({ email: tcEmail });
  const hodUser = await User.findOne({ email: hodEmail });

  // 1. TC authentication
  console.log('--- 1. TC Authentication ---');
  const loginRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/auth/login',
    body: { email: tcEmail, password },
  });
  assert(loginRes.statusCode === 200, 'TC login returns HTTP 200');
  const tcToken = loginRes.body.data && (loginRes.body.data.token || loginRes.body.token);
  const tcRole = loginRes.body.data && (loginRes.body.data.role || (loginRes.body.data.user && loginRes.body.data.user.role));
  assert(Boolean(tcToken), 'TC JWT token received');
  assert(tcRole === 'TC', `TC role in token is 'TC' (got: ${tcRole})`);

  const hodToken = generateToken(hodUser);

  // Setup isolated contexts: Context A (III-A) and Context B (III-B)
  const contextA = await AcademicContext.findOneAndUpdate(
    { academicYear: '2026-27', department: 'CSE', year: 'III Year', semester: 'Odd Semester', section: 'A' },
    { $set: { status: 'ACTIVE', program: 'UG' } },
    { upsert: true, new: true }
  );
  const contextB = await AcademicContext.findOneAndUpdate(
    { academicYear: '2026-27', department: 'CSE', year: 'III Year', semester: 'Odd Semester', section: 'B' },
    { $set: { status: 'ACTIVE', program: 'UG' } },
    { upsert: true, new: true }
  );

  const ctxAId = contextA._id.toString();
  const ctxBId = contextB._id.toString();

  // Clean any existing proposals for these contexts
  await TCAllocationProposal.deleteMany({ academicContextId: { $in: [contextA._id, contextB._id] } });

  // 2. TC can create assignment/proposal
  console.log('\n--- 2. TC Create Assignment / Proposal ---');
  const createRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/tc-proposals',
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      academicContextId: ctxAId,
      courseCode: '22CSC14',
      facultyId: 'FWL-04',
      facultyAssignments: [{ facultyId: 'FWL-04', role: 'THEORY' }],
      allocationType: 'THEORY',
    },
  });
  assert(createRes.statusCode === 201 || createRes.statusCode === 200, `TC create proposal returns HTTP ${createRes.statusCode}`);
  assert(createRes.body.success === true, 'Response body success is true');
  const prop1Id = createRes.body.data && createRes.body.data._id;
  assert(Boolean(prop1Id), 'Proposal record created with ID');
  assert(createRes.body.data.status === 'DRAFT', `Initial proposal status is 'DRAFT' (got: ${createRes.body.data.status})`);

  // 3. TC can save THEORY assignment
  console.log('\n--- 3. TC Save THEORY Assignment ---');
  const saveTheoryRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/22CSC14`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      facultyId: 'FWL-04',
      facultyAssignments: [{ facultyId: 'FWL-04', role: 'THEORY' }],
      allocationType: 'THEORY',
    },
  });
  assert(saveTheoryRes.statusCode === 200, `TC save THEORY returns HTTP 200`);
  assert(saveTheoryRes.body.data.facultyId === 'FWL-04', 'Theory facultyId matches FWL-04');
  assert(saveTheoryRes.body.data.status === 'DRAFT', 'Proposal status remains DRAFT');

  // 4. TC can save LAB PRIMARY
  console.log('\n--- 4. TC Save LAB PRIMARY ---');
  // Need theory course 22CSC15 allocated first for linked lab 22CSP09
  await HODFacultyAllocation.findOneAndUpdate(
    { academicContextId: contextA._id, courseCode: '22CSC15' },
    {
      $set: {
        academicContextId: contextA._id,
        courseCode: '22CSC15',
        courseName: 'Full Stack Development',
        facultyId: 'FWL-05',
        facultyAssignments: [{ facultyId: 'FWL-05', role: 'THEORY' }],
        allocationRule: 'THEORY_SINGLE',
        status: 'APPROVED',
        assignedBy: 'HOD',
      },
    },
    { upsert: true }
  );

  const saveLabRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/22CSP09`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      facultyAssignments: [
        { facultyId: 'FWL-05', role: 'PRIMARY' },
        { facultyId: 'FWL-06', role: 'ADDITIONAL' },
      ],
      allocationType: 'LAB_PRIMARY',
    },
  });
  assert(saveLabRes.statusCode === 200 || saveLabRes.statusCode === 201, `TC save LAB PRIMARY returns HTTP ${saveLabRes.statusCode}`);
  const primarySlot = (saveLabRes.body.data.facultyAssignments || []).find((f) => f.role === 'PRIMARY');
  assert(primarySlot && primarySlot.facultyId === 'FWL-05', 'LAB PRIMARY slot saved successfully');

  // 5. TC can save LAB ADDITIONAL
  console.log('\n--- 5. TC Save LAB ADDITIONAL ---');
  const additionalSlot = (saveLabRes.body.data.facultyAssignments || []).find((f) => f.role === 'ADDITIONAL');
  assert(additionalSlot && additionalSlot.facultyId === 'FWL-06', 'LAB ADDITIONAL slot saved successfully');

  // 6. TC can save LAB OPTIONAL
  console.log('\n--- 6. TC Save LAB OPTIONAL ---');
  const saveLabOptRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/22CSP09`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      facultyAssignments: [
        { facultyId: 'FWL-05', role: 'PRIMARY' },
        { facultyId: 'FWL-06', role: 'ADDITIONAL' },
        { facultyId: 'FWL-07', role: 'OPTIONAL' },
      ],
      allocationType: 'LAB_PRIMARY',
    },
  });
  assert(saveLabOptRes.statusCode === 200, `TC save LAB OPTIONAL returns HTTP 200`);
  const optSlot = (saveLabOptRes.body.data.facultyAssignments || []).find((f) => f.role === 'OPTIONAL');
  assert(optSlot && optSlot.facultyId === 'FWL-07', 'LAB OPTIONAL slot saved successfully');

  // 7. TC can save PG assignment
  console.log('\n--- 7. TC Save PG Assignment ---');
  const tempPgCourse1 = await Course.findOneAndUpdate(
    { courseCode: 'TEMP_PG01' },
    {
      $set: {
        courseCode: 'TEMP_PG01',
        courseName: 'Advanced Data Structures & Algorithms',
        category: 'PG',
        courseType: 'THEORY',
        isPgSubject: true,
        semester: 'Semester V',
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );

  const savePgRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/TEMP_PG01`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      facultyId: 'FWL-08',
      facultyAssignments: [{ facultyId: 'FWL-08', role: 'THEORY' }],
      allocationType: 'PG',
    },
  });
  assert(savePgRes.statusCode === 200 || savePgRes.statusCode === 201, `TC save PG assignment returns HTTP ${savePgRes.statusCode}`);
  assert(savePgRes.body.data.allocationType === 'PG', 'PG allocationType persisted');

  // 8. academicContextId isolation
  console.log('\n--- 8. academicContextId Isolation ---');
  const listContextB = await makeRequest(app, {
    method: 'GET',
    path: `/api/tc-proposals/context/${ctxBId}`,
    headers: { Authorization: `Bearer ${tcToken}` },
  });
  assert(listContextB.statusCode === 200, 'Query proposals for Context B returns HTTP 200');
  const itemsB = Array.isArray(listContextB.body.data) ? listContextB.body.data : [];
  assert(itemsB.length === 0, `Context B has 0 proposals (got: ${itemsB.length}) — no leak from Context A`);

  // 9. Theory max-2 rejection
  console.log('\n--- 9. Theory max-2 Rejection ---');
  const tempTh1 = await Course.findOneAndUpdate(
    { courseCode: 'TEMP_TH01' },
    { $set: { courseCode: 'TEMP_TH01', courseName: 'Temp Theory 1', semester: 'Semester V', isActive: true } },
    { upsert: true, new: true }
  );
  const tempTh2 = await Course.findOneAndUpdate(
    { courseCode: 'TEMP_TH02' },
    { $set: { courseCode: 'TEMP_TH02', courseName: 'Temp Theory 2', semester: 'Semester V', isActive: true } },
    { upsert: true, new: true }
  );
  const tempTh3 = await Course.findOneAndUpdate(
    { courseCode: 'TEMP_TH03' },
    { $set: { courseCode: 'TEMP_TH03', courseName: 'Temp Theory 3', semester: 'Semester V', isActive: true } },
    { upsert: true, new: true }
  );

  await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/TEMP_TH01`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: { facultyId: 'FWL-10', allocationType: 'THEORY', facultyAssignments: [{ facultyId: 'FWL-10', role: 'THEORY' }] },
  });
  await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/TEMP_TH02`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: { facultyId: 'FWL-10', allocationType: 'THEORY', facultyAssignments: [{ facultyId: 'FWL-10', role: 'THEORY' }] },
  });

  const thirdTheoryRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/TEMP_TH03`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: { facultyId: 'FWL-10', allocationType: 'THEORY', facultyAssignments: [{ facultyId: 'FWL-10', role: 'THEORY' }] },
  });
  assert(thirdTheoryRes.statusCode === 400, `3rd Theory assignment rejected with HTTP 400 (got: ${thirdTheoryRes.statusCode})`);
  assert(thirdTheoryRes.body.code === 'THEORY_LOAD_LIMIT_EXCEEDED', `Error code is THEORY_LOAD_LIMIT_EXCEEDED (got: ${thirdTheoryRes.body.code})`);

  // Clean temp theory courses
  await TCAllocationProposal.deleteMany({ courseCode: /^TEMP_TH/ });
  await Course.deleteMany({ courseCode: /^TEMP_TH/ });

  // 10. Lab max-2 rejection
  console.log('\n--- 10. Lab max-2 Rejection ---');
  const tempLab1 = await Course.findOneAndUpdate(
    { courseCode: 'TEMP_LB01' },
    { $set: { courseCode: 'TEMP_LB01', courseName: 'Temp Lab 1', isLab: true, courseType: 'LAB', semester: 'Semester V', isActive: true } },
    { upsert: true, new: true }
  );
  const tempLab2 = await Course.findOneAndUpdate(
    { courseCode: 'TEMP_LB02' },
    { $set: { courseCode: 'TEMP_LB02', courseName: 'Temp Lab 2', isLab: true, courseType: 'LAB', semester: 'Semester V', isActive: true } },
    { upsert: true, new: true }
  );
  const tempLab3 = await Course.findOneAndUpdate(
    { courseCode: 'TEMP_LB03' },
    { $set: { courseCode: 'TEMP_LB03', courseName: 'Temp Lab 3', isLab: true, courseType: 'LAB', semester: 'Semester V', isActive: true } },
    { upsert: true, new: true }
  );

  // Lab 1 for FWL-11
  await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/TEMP_LB01`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      facultyAssignments: [{ facultyId: 'FWL-11', role: 'PRIMARY' }, { facultyId: 'FWL-06', role: 'ADDITIONAL' }],
      allocationType: 'LAB_PRIMARY',
    },
  });

  // Lab 2 for FWL-11
  await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/TEMP_LB02`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      facultyAssignments: [{ facultyId: 'FWL-11', role: 'PRIMARY' }, { facultyId: 'FWL-06', role: 'ADDITIONAL' }],
      allocationType: 'LAB_PRIMARY',
    },
  });

  // Attempt Lab 3 for FWL-11
  const thirdLabRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/TEMP_LB03`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      facultyAssignments: [{ facultyId: 'FWL-11', role: 'PRIMARY' }, { facultyId: 'FWL-06', role: 'ADDITIONAL' }],
      allocationType: 'LAB_PRIMARY',
    },
  });
  assert(thirdLabRes.statusCode === 400, `3rd Lab assignment rejected with HTTP 400 (got: ${thirdLabRes.statusCode})`);
  assert(thirdLabRes.body.code === 'LAB_LOAD_LIMIT_EXCEEDED', `Error code is LAB_LOAD_LIMIT_EXCEEDED (got: ${thirdLabRes.body.code})`);

  // Clean temp lab courses
  await TCAllocationProposal.deleteMany({ courseCode: /^TEMP_LB/ });
  await Course.deleteMany({ courseCode: /^TEMP_LB/ });

  // 11. PG max-1 rejection
  console.log('\n--- 11. PG max-1 Rejection ---');
  const tempPgCourse2 = await Course.findOneAndUpdate(
    { courseCode: 'TEMP_PG02' },
    { $set: { courseCode: 'TEMP_PG02', courseName: 'Temp PG 2', category: 'PG', isPgSubject: true, semester: 'Semester V', isActive: true } },
    { upsert: true, new: true }
  );

  const secondPgRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/TEMP_PG02`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: { facultyId: 'FWL-08', allocationType: 'PG', facultyAssignments: [{ facultyId: 'FWL-08', role: 'THEORY' }] },
  });
  assert(secondPgRes.statusCode === 400, `2nd PG assignment rejected with HTTP 400 (got: ${secondPgRes.statusCode})`);
  assert(secondPgRes.body.code === 'PG_LOAD_LIMIT_EXCEEDED', `Error code is PG_LOAD_LIMIT_EXCEEDED (got: ${secondPgRes.body.code})`);

  // Clean temp PG courses
  await TCAllocationProposal.deleteMany({ courseCode: /^TEMP_PG/ });
  await Course.deleteMany({ courseCode: /^TEMP_PG/ });

  // 12. TC cannot mutate approved HOD allocation directly
  console.log('\n--- 12. TC Cannot Mutate Approved HOD Allocation Directly ---');
  const directHodMutateRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/hod-allocations/context/${ctxAId}/course/22CSC14`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: { facultyId: 'FWL-09', allocationType: 'THEORY' },
  });
  assert(directHodMutateRes.statusCode === 403, `TC calling HOD allocation mutation returns HTTP 403 (got: ${directHodMutateRes.statusCode})`);

  const tcApproveRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/tc-proposals/${prop1Id}/approve`,
    headers: { Authorization: `Bearer ${tcToken}` },
  });
  assert(tcApproveRes.statusCode === 403, `TC calling proposal approve returns HTTP 403 (got: ${tcApproveRes.statusCode})`);

  // 13. HOD can review
  console.log('\n--- 13. HOD Can Review ---');
  const submitRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/tc-proposals/${prop1Id}/submit`,
    headers: { Authorization: `Bearer ${tcToken}` },
  });
  assert(submitRes.statusCode === 200, `TC submit returns HTTP 200 (got: ${submitRes.statusCode})`);
  assert(submitRes.body.data.status === 'SUBMITTED', 'Proposal status transitioned to SUBMITTED');

  // HOD views proposals
  const hodReviewRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/tc-proposals/context/${ctxAId}`,
    headers: { Authorization: `Bearer ${hodToken}` },
  });
  assert(hodReviewRes.statusCode === 200, 'HOD review list returns HTTP 200');
  const hodViewItems = Array.isArray(hodReviewRes.body.data) ? hodReviewRes.body.data : [];
  const foundSubmitted = hodViewItems.find((p) => p._id.toString() === prop1Id && p.status === 'SUBMITTED');
  assert(Boolean(foundSubmitted), 'HOD sees the proposal with status SUBMITTED');

  // 14. HOD can approve
  console.log('\n--- 14. HOD Can Approve ---');
  const hodApproveRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/tc-proposals/${prop1Id}/approve`,
    headers: { Authorization: `Bearer ${hodToken}` },
  });
  assert(hodApproveRes.statusCode === 200, `HOD approve returns HTTP 200 (got: ${hodApproveRes.statusCode})`);
  assert(hodApproveRes.body.data.proposal.status === 'APPROVED', 'Proposal status is APPROVED');

  // 15. Approval updates authoritative allocation
  console.log('\n--- 15. Approval Updates Authoritative Allocation ---');
  const authAlloc = await HODFacultyAllocation.findOne({
    academicContextId: contextA._id,
    courseCode: '22CSC14',
    status: 'APPROVED',
  });
  assert(Boolean(authAlloc), 'Authoritative HODFacultyAllocation exists in MongoDB with status APPROVED');
  assert(authAlloc.facultyId === 'FWL-04', `Approved facultyId matches proposed (FWL-04)`);

  // 16. HOD can reject with remarks
  console.log('\n--- 16. HOD Can Reject with Remarks ---');
  // Clean 22MAN8R from HOD allocation first so it's strictly unallocated
  await HODFacultyAllocation.deleteMany({ academicContextId: contextA._id, courseCode: '22MAN8R' });

  // Mathematics and English faculty
  const mathsFac = await Faculty.findOne({ department: /Mathematics/i, isActive: true }) || { facultyId: 'FWL-23' };
  const engFac = await Faculty.findOne({ department: /English/i, isActive: true }) || { facultyId: 'FWL-24' };

  const prop2Res = await makeRequest(app, {
    method: 'POST',
    path: '/api/tc-proposals',
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      academicContextId: ctxAId,
      courseCode: '22MAN8R',
      facultyAssignments: [
        { facultyId: mathsFac.facultyId, role: 'MATHS_BME' },
        { facultyId: engFac.facultyId, role: 'ENGLISH' },
      ],
      allocationType: 'SAS',
      status: 'SUBMITTED',
    },
  });
  const prop2Id = prop2Res.body.data._id;

  const rejectRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/tc-proposals/${prop2Id}/reject`,
    headers: { Authorization: `Bearer ${hodToken}` },
    body: { remarks: 'Mathematics faculty workload needs adjustment' },
  });
  assert(rejectRes.statusCode === 200, `HOD reject returns HTTP 200 (got: ${rejectRes.statusCode})`);
  assert(rejectRes.body.data.status === 'REJECTED', 'Proposal status is REJECTED');
  assert(rejectRes.body.data.remarks === 'Mathematics faculty workload needs adjustment', 'Rejection remarks saved');

  const unapprovedHodAlloc = await HODFacultyAllocation.findOne({
    academicContextId: contextA._id,
    courseCode: '22MAN8R',
    status: 'APPROVED',
  });
  assert(!unapprovedHodAlloc, 'No authoritative approved HOD allocation exists for rejected proposal');

  // 17. Rejected proposal can be revised
  console.log('\n--- 17. Rejected Proposal Can Be Revised ---');
  const reviseRes = await makeRequest(app, {
    method: 'PUT',
    path: `/api/tc-proposals/context/${ctxAId}/course/22MAN8R`,
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      facultyAssignments: [
        { facultyId: mathsFac.facultyId, role: 'MATHS_BME' },
        { facultyId: engFac.facultyId, role: 'ENGLISH' },
      ],
      allocationType: 'SAS',
    },
  });
  assert(reviseRes.statusCode === 200, `TC revise rejected proposal returns HTTP 200 (got: ${reviseRes.statusCode})`);
  assert(reviseRes.body.data.status === 'DRAFT', `Revised proposal status returned to DRAFT (got: ${reviseRes.body.data.status})`);

  // 18. Revised proposal can be resubmitted
  console.log('\n--- 18. Revised Proposal Can Be Resubmitted ---');
  const resubmitRes = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/tc-proposals/${prop2Id}/submit`,
    headers: { Authorization: `Bearer ${tcToken}` },
  });
  assert(resubmitRes.statusCode === 200, `TC resubmit returns HTTP 200 (got: ${resubmitRes.statusCode})`);
  assert(resubmitRes.body.data.status === 'SUBMITTED', 'Resubmitted proposal status is SUBMITTED');

  // 19. Unapproved proposal is not used for generation
  console.log('\n--- 19. Unapproved Proposal Not Used for Generation ---');
  const designCtxRes = await makeRequest(app, {
    method: 'GET',
    path: `/api/timetable/design-context/${ctxAId}`,
    headers: { Authorization: `Bearer ${tcToken}` },
  });
  assert(designCtxRes.statusCode === 200, 'Design context fetch succeeds');
  const unapprovedInDesign = (designCtxRes.body.data && designCtxRes.body.data.courses || []).find((c) => c.courseCode === '22MAN8R');
  assert(
    !unapprovedInDesign || unapprovedInDesign.allocationStatus === 'UNALLOCATED',
    'Unapproved proposal is not considered allocated in design context'
  );

  const prematureGenRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/generate-from-context',
    headers: { Authorization: `Bearer ${tcToken}` },
    body: { academicContextId: ctxAId },
  });
  assert(prematureGenRes.statusCode === 409, `Generation with unapproved proposal blocked with HTTP 409 (got: ${prematureGenRes.statusCode})`);

  // 20. Approved allocation is used by generateFromContext
  console.log('\n--- 20. Approved Allocation Used by generateFromContext ---');
  const approve2Res = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/tc-proposals/${prop2Id}/approve`,
    headers: { Authorization: `Bearer ${hodToken}` },
  });
  assert(approve2Res.statusCode === 200, 'HOD approves resubmitted proposal (HTTP 200)');

  // Ensure all Semester V courses have approved allocations with valid non-conflicting faculty
  const coreV = [
    { code: '22CSC14', fid: 'FWL-04', type: 'THEORY' },
    { code: '22CSC15', fid: 'FWL-05', type: 'THEORY' },
    { code: '22CSC16', fid: 'FWL-03', type: 'THEORY' },
    { code: '22CSP09', fid: 'FWL-14', type: 'LAB', addFid: 'FWL-08' },
    { code: '22CSP10', fid: 'FWL-03', type: 'LAB', addFid: 'FWL-12' },
  ];

  for (const c of coreV) {
    const isLab = c.type === 'LAB';
    const assignments = isLab
      ? [{ facultyId: c.fid, role: 'PRIMARY' }, { facultyId: c.addFid, role: 'ADDITIONAL' }]
      : [{ facultyId: c.fid, role: 'THEORY' }];

    await HODFacultyAllocation.findOneAndUpdate(
      { academicContextId: contextA._id, courseCode: c.code },
      {
        $set: {
          academicContextId: contextA._id,
          courseCode: c.code,
          courseName: c.code,
          facultyId: c.fid,
          facultyAssignments: assignments,
          allocationRule: isLab ? 'LAB_2_TO_3' : 'THEORY_SINGLE',
          status: 'APPROVED',
          assignedBy: 'HOD',
        },
      },
      { upsert: true }
    );
  }

  // Create clean TimetableVersion for generation
  const tv = await TimetableVersion.create({
    academicContextId: contextA._id,
    academicYear: '2026-27',
    semester: 'Odd Semester',
    department: 'CSE',
    year: 'III Year',
    section: 'A',
    label: 'TC-Proposal-Approved-Gen-Run',
    status: 'DRAFT',
  });

  const fullGenRes = await makeRequest(app, {
    method: 'POST',
    path: '/api/timetable/generate-from-context',
    headers: { Authorization: `Bearer ${tcToken}` },
    body: {
      academicContextId: ctxAId,
      timetableVersionId: tv._id.toString(),
      generationSeed: 42,
    },
  });
  const createdCount = fullGenRes.body.data && (fullGenRes.body.data.sessionsCreated || fullGenRes.body.data.sessionCount || (fullGenRes.body.data.sessions && fullGenRes.body.data.sessions.length));
  assert(createdCount > 0, `Sessions were generated using approved allocations (count: ${createdCount})`);

  // Verify that the session generated for 22MAN8R has the approved faculty
  const manSessions = await TimetableSession.find({
    timetableVersionId: tv._id,
    courseCode: '22MAN8R',
  });
  assert(manSessions.length > 0, `Generated timetable includes sessions for 22MAN8R approved from TC proposal (count: ${manSessions.length})`);

  // Cleanup
  await TCAllocationProposal.deleteMany({ academicContextId: { $in: [contextA._id, contextB._id] } });
  await User.deleteMany({ email: { $in: [tcEmail, hodEmail] } });
  await HODFacultyAllocation.findOneAndUpdate(
    { academicContextId: contextA._id, courseCode: '22MAN8R' },
    { $set: { facultyId: 'MAT-001', facultyName: 'Mathematics Faculty', facultyAssignments: [{ facultyId: 'MAT-001', role: 'THEORY' }] } }
  );
  if (tv) {
    await TimetableSession.deleteMany({ timetableVersionId: tv._id });
    await TimetableVersion.findByIdAndDelete(tv._id);
  }
  await seedTimetable();

  console.log('\n============================================================');
  console.log(`TC PROPOSAL WORKFLOW RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('============================================================\n');

  if (failCount > 0) process.exitCode = 1;

  await disconnectDB();
}

run().catch((err) => {
  console.error('[TC Allocation Proposal Test Error]:', err);
  process.exitCode = 1;
});
