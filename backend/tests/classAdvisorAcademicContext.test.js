/**
 * Phase 8 - Class Advisor AcademicContext scoping test suite.
 *
 * Covers:
 *   A. Authentication (unauthenticated -> 401)
 *   B. RBAC (HOD allowed, ADMIN allowed, TC 403, FACULTY 403)
 *   C. Context scope (valid / invalid / no cross-context leakage)
 *   D. Academic-year separation (2026-27 III-A and 2027-28 III-A coexist)
 *   E. Duplicate protection (one ACTIVE advisor per AcademicContext)
 *   F. Reassignment (scoped to one context only)
 *   G. Historical preservation (old year survives a new-year assignment)
 *   H. Cross-context protection
 *
 * Isolation: every fixture uses department 'P8CA', which does not exist in the
 * seeded data. Cleanup only deletes records carrying that department, or faculty /
 * users tagged with the P8- prefix. No seeded record is modified or removed.
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const AcademicContext = require('../src/models/AcademicContext');
const ClassAdvisorAssignment = require('../src/models/ClassAdvisorAssignment');
const { generateToken } = require('../src/utils/generateToken');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  PASS: ${message}`);
  } else {
    failCount++;
    console.error(`  FAIL: ${message}`);
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
      const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: reqHeaders }, (res) => {
        let rawData = '';
        res.on('data', (c) => (rawData += c));
        res.on('end', () => {
          server.close();
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(rawData) });
          } catch (_) {
            resolve({ statusCode: res.statusCode, body: rawData });
          }
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

const TEST_DEPT = 'P8CA';
const emails = {
  hod: 'p8_ca_hod@nec.edu.in',
  admin: 'p8_ca_admin@nec.edu.in',
  tc: 'p8_ca_tc@nec.edu.in',
  faculty: 'p8_ca_fac@nec.edu.in',
};

async function ctxIds() {
  const rows = await AcademicContext.find({ department: TEST_DEPT }).select('_id').lean();
  return rows.map((r) => r._id);
}

async function cleanup() {
  await ClassAdvisorAssignment.deleteMany({ academicContextId: { $in: await ctxIds() } });
  await AcademicContext.deleteMany({ department: TEST_DEPT });
  await Faculty.deleteMany({ facultyId: /^P8-/ });
  await User.deleteMany({ email: { $in: Object.values(emails) } });
}

async function makeUser(email, role) {
  return User.findOneAndUpdate(
    { email },
    { $set: { name: 'Phase 8 CA ' + role, email, role, isActive: true } },
    { upsert: true, new: true }
  );
}

async function makeFaculty(facultyId, name) {
  return Faculty.findOneAndUpdate(
    { facultyId },
    { $set: { facultyId, facultyName: name, designation: 'Assistant Professor', department: TEST_DEPT, isActive: true } },
    { upsert: true, new: true }
  );
}

async function makeContext({ from, to, year, section, semester }) {
  return AcademicContext.create({
    academicYearFrom: from,
    academicYearTo: to,
    semester: semester || 'Phase8 CA Semester',
    department: TEST_DEPT,
    year,
    section,
    program: 'UG',
    status: 'ACTIVE',
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 8: CLASS ADVISOR ACADEMIC CONTEXT - TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  const hod = await makeUser(emails.hod, 'HOD');
  const admin = await makeUser(emails.admin, 'ADMIN');
  const tc = await makeUser(emails.tc, 'TC');
  const fac = await makeUser(emails.faculty, 'FACULTY');
  const hodH = { Authorization: `Bearer ${generateToken(hod)}` };
  const adminH = { Authorization: `Bearer ${generateToken(admin)}` };
  const tcH = { Authorization: `Bearer ${generateToken(tc)}` };
  const facH = { Authorization: `Bearer ${generateToken(fac)}` };

  await makeFaculty('P8-FAC-A', 'Phase 8 Advisor A');
  await makeFaculty('P8-FAC-B', 'Phase 8 Advisor B');
  await makeFaculty('P8-FAC-C', 'Phase 8 Advisor C');

  // Two academic years of the SAME cohort/section.
  const ctx2026 = await makeContext({ from: 2026, to: 2027, year: 'III Year', section: 'A' });
  const ctx2027 = await makeContext({ from: 2027, to: 2028, year: 'III Year', section: 'A' });
  const ctxOther = await makeContext({ from: 2026, to: 2027, year: 'III Year', section: 'B' });

  const assign = (ctxId, facultyId, headers) =>
    makeRequest(app, {
      method: 'POST',
      path: '/api/class-advisors',
      headers,
      body: { academicContextId: String(ctxId), facultyId },
    });

  console.log('\n-- A: Authentication ---------------------------------------');

  const anonRead = await makeRequest(app, { method: 'GET', path: '/api/class-advisors' });
  assert(anonRead.statusCode === 401, `Unauthenticated advisor list -> 401 (got ${anonRead.statusCode})`);
  const anonAssign = await assign(ctx2026._id, 'P8-FAC-A', {});
  assert(anonAssign.statusCode === 401, `Unauthenticated assignment -> 401 (got ${anonAssign.statusCode})`);

  console.log('\n-- B: RBAC ---------------------------------------------------');

  assert(tcH && (await assign(ctx2026._id, 'P8-FAC-A', tcH)).statusCode === 403, 'TC cannot assign a class advisor');
  assert((await assign(ctx2026._id, 'P8-FAC-A', facH)).statusCode === 403, 'FACULTY cannot assign a class advisor');

  const adminTry = await assign(ctxOther._id, 'P8-FAC-C', adminH);
  assert(adminTry.statusCode === 201, `ADMIN retains override authority -> 201 (got ${adminTry.statusCode})`);

  const hodTry = await assign(ctx2026._id, 'P8-FAC-A', hodH);
  assert(hodTry.statusCode === 201, `HOD retains assignment authority -> 201 (got ${hodTry.statusCode})`);

  console.log('\n-- C: Context Scope -----------------------------------------');

  const badCtx = await assign('6aba13b47439464f20c4ceee', 'P8-FAC-B', hodH);
  assert(badCtx.statusCode === 404 && badCtx.body.code === 'CONTEXT_NOT_FOUND', `Unknown context -> 404 CONTEXT_NOT_FOUND (got ${badCtx.statusCode}/${badCtx.body.code})`);

  const malformedCtx = await makeRequest(app, {
    method: 'POST',
    path: '/api/class-advisors',
    headers: hodH,
    body: { academicContextId: 'not-an-id', facultyId: 'P8-FAC-B' },
  });
  assert(malformedCtx.statusCode === 400, `Malformed academicContextId -> 400 (got ${malformedCtx.statusCode})`);

  const badFaculty = await assign(ctx2027._id, 'P8-DOES-NOT-EXIST', hodH);
  assert(badFaculty.statusCode === 404 && badFaculty.body.code === 'FACULTY_NOT_FOUND', `Unknown faculty -> 404 FACULTY_NOT_FOUND (got ${badFaculty.statusCode}/${badFaculty.body.code})`);

  const listA = await makeRequest(app, { method: 'GET', path: `/api/class-advisors?academicContextId=${ctx2026._id}`, headers: hodH });
  assert(listA.statusCode === 200 && listA.body.data.length === 1, 'Context-scoped advisor read returns exactly one');
  assert(String(listA.body.data[0].facultyId) === 'P8-FAC-A', 'Context A holds the expected advisor');

  const listOther = await makeRequest(app, { method: 'GET', path: `/api/class-advisors?academicContextId=${ctxOther._id}`, headers: hodH });
  assert(listOther.body.data[0].facultyId === 'P8-FAC-C', 'Context B holds its own advisor');

  console.log('\n-- D: Academic-Year Separation ------------------------------');

  const y2027 = await assign(ctx2027._id, 'P8-FAC-B', hodH);
  assert(y2027.statusCode === 201, `2027-28 III-A assignment -> 201 (got ${y2027.statusCode})`);

  const both = await ClassAdvisorAssignment.find({ academicContextId: { $in: [ctx2026._id, ctx2027._id] }, status: 'ACTIVE' }).lean();
  assert(both.length === 2, `Both academic years hold an active advisor simultaneously (got ${both.length})`);
  const ids = both.map((b) => String(b.facultyId)).sort();
  assert(ids.join(',') === 'P8-FAC-A,P8-FAC-B', `Each year has its own advisor (got ${ids.join(',')})`);

  console.log('\n-- E: Duplicate Protection ---------------------------------');

  // The service deactivates the previous advisor, so exactly one stays ACTIVE.
  const reassign = await assign(ctx2026._id, 'P8-FAC-C', hodH);
  assert(reassign.statusCode === 201, `Reassignment in the same context -> 201 (got ${reassign.statusCode})`);

  const activeIn2026 = await ClassAdvisorAssignment.find({ academicContextId: ctx2026._id, status: 'ACTIVE' }).lean();
  assert(activeIn2026.length === 1, `Exactly one ACTIVE advisor per context (got ${activeIn2026.length})`);
  assert(activeIn2026[0].facultyId === 'P8-FAC-C', 'The reassigned advisor is the active one');

  // Direct insert bypassing the service must still be blocked by the DB invariant.
  const forced = await ClassAdvisorAssignment.create({
    academicContextId: ctx2026._id,
    facultyId: 'P8-FAC-B',
    assignedBy: 'P8-TEST',
    status: 'ACTIVE',
  }).then(() => null, (e) => e);
  assert(!!forced && forced.code === 11000, `A second ACTIVE advisor is rejected by the unique invariant (${forced ? forced.code : 'none'})`);

  console.log('\n-- F: Reassignment Is Scoped -------------------------------');

  const active2027 = await ClassAdvisorAssignment.find({ academicContextId: ctx2027._id, status: 'ACTIVE' }).lean();
  assert(active2027.length === 1 && active2027[0].facultyId === 'P8-FAC-B', 'Reassigning 2026-27 left 2027-28 untouched');

  console.log('\n-- G: Historical Preservation ------------------------------');

  const hist2026 = await ClassAdvisorAssignment.find({ academicContextId: ctx2026._id }).sort({ createdAt: 1 }).lean();
  assert(hist2026.length >= 2, `Old 2026-27 assignments are retained as history (got ${hist2026.length})`);
  const inactive = hist2026.filter((h) => h.status === 'INACTIVE');
  assert(inactive.length >= 1, `The superseded 2026-27 advisor is preserved as INACTIVE (got ${inactive.length})`);
  assert(inactive.some((h) => h.facultyId === 'P8-FAC-A'), 'The original 2026-27 advisor (P8-FAC-A) still exists historically');

  console.log('\n-- H: Cross-Context Protection -----------------------------');

  const ctxA2026 = await ClassAdvisorAssignment.findOne({ academicContextId: ctx2026._id, status: 'ACTIVE' }).lean();
  const otherA = await ClassAdvisorAssignment.findOne({ academicContextId: ctxOther._id, status: 'ACTIVE' }).lean();
  assert(String(ctxA2026.academicContextId) !== String(otherA.academicContextId), 'The two contexts hold distinct assignments');
  assert(otherA.facultyId === 'P8-FAC-C', 'Context B was never overwritten by Context A activity');

  const deactivateA = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/class-advisors/${ctxA2026._id}/deactivate`,
    headers: hodH,
  });
  assert(deactivateA.statusCode === 200, `HOD can deactivate -> 200 (got ${deactivateA.statusCode})`);
  const stillOther = await ClassAdvisorAssignment.findOne({ academicContextId: ctxOther._id, status: 'ACTIVE' }).lean();
  assert(!!stillOther && stillOther.facultyId === 'P8-FAC-C', 'Deactivating one context does not affect another');

  const deactivateTc = await makeRequest(app, {
    method: 'PATCH',
    path: `/api/class-advisors/${ctxA2026._id}/deactivate`,
    headers: tcH,
  });
  assert(deactivateTc.statusCode === 403, `TC cannot deactivate a class advisor (got ${deactivateTc.statusCode})`);

  console.log('\n===============================================================');
  console.log(`PHASE 8 CLASS ADVISOR CONTEXT: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================\n');
}

(async () => {
  try {
    await runTests();
  } catch (error) {
    failCount++;
    console.error('\n[FATAL] Phase 8 class advisor suite aborted:', error && error.message ? error.message : error);
  } finally {
    await cleanup();
    await disconnectDB();
  }
  process.exit(failCount > 0 ? 1 : 0);
})();
