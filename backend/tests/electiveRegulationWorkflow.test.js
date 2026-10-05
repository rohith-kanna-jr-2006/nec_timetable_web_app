/**
 * Phase 10 - Elective Object (EO) selection + regulation-aware curriculum suite.
 *
 * Isolation: every fixture uses department 'P10EO' / faculty prefix 'P10-' /
 * course prefix 'P10', none of which exist in seeded data. Cleanup removes only
 * records carrying those markers. Shared III-A and R22 seed data are read-only
 * inputs and are never mutated.
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const Course = require('../src/models/Course');
const AcademicContext = require('../src/models/AcademicContext');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const { generateToken } = require('../src/utils/generateToken');
const electiveService = require('../src/services/electiveSelectionService');

const TEST_DEPT = 'P10EO';
const emails = {
  hod: 'p10_eo_hod@nec.edu.in',
  admin: 'p10_eo_admin@nec.edu.in',
  tc: 'p10_eo_tc@nec.edu.in',
  faculty: 'p10_eo_fac@nec.edu.in',
};

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log('  PASS: ' + message);
  } else {
    failCount++;
    console.error('  FAIL: ' + message);
  }
}

function makeRequest(appInstance, opts) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, () => {
      const port = server.address().port;
      const payload = opts.body ? JSON.stringify(opts.body) : null;
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
      const req = http.request(
        { hostname: '127.0.0.1', port, path: opts.path, method: opts.method || 'GET', headers: headers },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            server.close();
            try {
              resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
            } catch (_) {
              resolve({ statusCode: res.statusCode, body: raw });
            }
          });
        }
      );
      req.on('error', (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function cleanup() {
  const ctxIds = (await AcademicContext.find({ department: TEST_DEPT }).select('_id').lean()).map((c) => c._id);
  await HODFacultyAllocation.deleteMany({ academicContextId: { $in: ctxIds } });
  await AcademicContext.deleteMany({ department: TEST_DEPT });
  await Course.deleteMany({ courseCode: /^P10/ });
  await Faculty.deleteMany({ facultyId: /^P10-/ });
  await User.deleteMany({ email: { $in: Object.values(emails) } });
}

async function makeUser(email, role) {
  const bcrypt = require('bcryptjs');
  return User.findOneAndUpdate(
    { email },
    { $set: { name: 'Phase 10 ' + role, email: email, role: role, isActive: true, passwordHash: await bcrypt.hash('Seed-Pass-1', 10) } },
    { upsert: true, new: true }
  );
}

/** Creates an isolated faculty fixture. */
async function makeFaculty(facultyId) {
  return Faculty.findOneAndUpdate(
    { facultyId: facultyId },
    { $set: { facultyId: facultyId, facultyName: 'Phase 10 Faculty', designation: 'Assistant Professor', department: TEST_DEPT, isActive: true } },
    { upsert: true, new: true }
  );
}

/** Creates an isolated EO catalog course. */
async function makeCourse(code, opts) {
  return Course.create(Object.assign({
    courseCode: code,
    courseName: 'Phase 10 ' + code,
    regulation: 'R22',
    semester: 'Programme Elective',
    category: 'PEC',
    electiveType: 'PEC',
    department: TEST_DEPT,
    isActive: true,
  }, opts || {}));
}

/** Creates an isolated AcademicContext for a given cohort year. */
async function makeContext(year, section, program) {
  return AcademicContext.create({
    academicYearFrom: 2098,
    academicYearTo: 2099,
    semester: 'Odd Semester',
    department: TEST_DEPT,
    year: year,
    section: section,
    program: program || 'UG',
    status: 'ACTIVE',
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 10: EO SELECTION + REGULATION WORKFLOW');
  console.log('===============================================================\n');

  await connectDB();

  const hod = await makeUser(emails.hod, 'HOD');
  const admin = await makeUser(emails.admin, 'ADMIN');
  const tc = await makeUser(emails.tc, 'TC');
  const fac = await makeUser(emails.faculty, 'FACULTY');
  const hodH = { Authorization: 'Bearer ' + generateToken(hod) };
  const adminH = { Authorization: 'Bearer ' + generateToken(admin) };
  const tcH = { Authorization: 'Bearer ' + generateToken(tc) };
  const facH = { Authorization: 'Bearer ' + generateToken(fac) };

  // III Year cohort -> Semester V -> PEC/OEC slots.
  const ctxA = await makeContext('III Year', 'A');
  const ctxB = await makeContext('III Year', 'B');
  await makeFaculty('P10-FAC-01');

  const pec = await makeCourse('P10PEC1', { electiveType: 'PEC', category: 'PEC' });
  const pec2 = await makeCourse('P10PEC2', { electiveType: 'PEC', category: 'PEC' });
  const oec = await makeCourse('P10OEC1', { electiveType: 'OEC', category: 'OEC', semester: 'Open Elective' });
  const pgCourse = await makeCourse('P10PG1', { electiveType: 'PEC', category: 'PEC', regulation: 'R22-PG' });
  const coreCourse = await makeCourse('P10CORE1', { electiveType: null, category: 'PPCC', semester: 'Semester V' });

  console.log('\n-- A: Regulation -----------------------------------------');

  const supported = await electiveService.getSupportedRegulations();
  assert(supported.indexOf('R22') !== -1, 'R22 resolves as a supported regulation');
  assert(supported.indexOf('R22-PG') !== -1, 'R22-PG resolves as a supported regulation (it really exists in data)');
  assert(supported.indexOf('R17') === -1, 'R17 is NOT fabricated as supported');
  assert(supported.indexOf('R26') === -1, 'R26 is NOT fabricated as supported');

  const r17 = await electiveService.assertSupportedRegulation('R17').then(() => null, (e) => e);
  assert(!!r17 && r17.code === 'REGULATION_NOT_SUPPORTED', 'Unsupported regulation returns REGULATION_NOT_SUPPORTED');
  assert(!!r17 && r17.statusCode === 404, 'Unsupported regulation is a structured 404');

  const wrongReg = await electiveService.validateElectiveSelection({ courseCode: 'P10PG1', academicContextId: ctxA._id }).then(() => null, (e) => e);
  assert(!!wrongReg && wrongReg.code === 'ELECTIVE_COURSE_WRONG_REGULATION', 'Course from another regulation is rejected');

  console.log('\n-- B: Semester / slot applicability ----------------------');

  assert(electiveService.resolveSemesterForContext(ctxA) === 'Semester V', 'III Year resolves to Semester V');
  const slots = electiveService.electiveSlotsForContext(ctxA).slots;
  assert(Array.isArray(slots) && slots.length > 0, 'Semester V exposes EO slots');

  const okSel = await electiveService.validateElectiveSelection({ courseCode: 'P10PEC1', academicContextId: ctxA._id });
  assert(!!okSel && okSel.course.courseCode === 'P10PEC1', 'Applicable PEC candidate is accepted');

  const oecSel = await electiveService.validateElectiveSelection({ courseCode: 'P10OEC1', academicContextId: ctxA._id }).then(() => null, (e) => e);
  assert(!oecSel, 'OEC candidate is accepted for a PEC/OEC slot semester');

  const notEo = await electiveService.validateElectiveSelection({ courseCode: 'P10CORE1', academicContextId: ctxA._id }).then(() => null, (e) => e);
  assert(!!notEo && notEo.code === 'COURSE_NOT_ELECTIVE', 'A non-elective course is rejected as an EO selection');

  const unknown = await electiveService.validateElectiveSelection({ courseCode: 'P10NOPE', academicContextId: ctxA._id }).then(() => null, (e) => e);
  assert(!!unknown && unknown.code === 'COURSE_NOT_FOUND', 'An unknown course is rejected');

  console.log('\n-- C: EO selection (HOD authority) -----------------------');

  const candsRes = await makeRequest(app, {
    path: '/api/hod-allocations/elective-candidates?academicContextId=' + ctxA._id,
    headers: hodH,
  });
  assert(candsRes.statusCode === 200, 'HOD can list EO candidates (got ' + candsRes.statusCode + ')');
  const codes = candsRes.body.data.candidates.map((c) => c.courseCode);
  assert(codes.indexOf('P10PEC1') !== -1, 'PEC candidate is offered to HOD');
  assert(codes.indexOf('P10PG1') === -1, 'A course from another regulation is NOT offered');
  assert(codes.indexOf('P10CORE1') === -1, 'A non-elective course is NOT offered as an EO candidate');
  assert(candsRes.body.data.regulation === 'R22', 'Candidate list reports the cohort regulation');

  const emptyRes = await makeRequest(app, { path: '/api/hod-allocations/elective-selection?academicContextId=' + ctxA._id, headers: hodH });
  assert(emptyRes.statusCode === 200, 'Active selection read works (got ' + emptyRes.statusCode + ')');
  assert(emptyRes.body.data.state === 'ELECTIVE_SELECTION_REQUIRED', 'No selection yet -> ELECTIVE_SELECTION_REQUIRED (got ' + emptyRes.body.data.state + ')');
  assert(emptyRes.body.data.selectedCount === 0, 'No active elective courses before HOD decides');

  const select = (courseCode, ctxId, headers) =>
    makeRequest(app, {
      method: 'POST',
      path: '/api/hod-allocations',
      headers: headers || hodH,
      body: {
        academicContextId: String(ctxId),
        courseCode: courseCode,
        facultyId: 'P10-FAC-01',
        facultyName: 'Phase 10 Faculty',
        allocationType: 'THEORY',
        status: 'APPROVED',
      },
    });

  const wrongRegSelect = await select('P10PG1', ctxA._id);
  assert(wrongRegSelect.statusCode === 409, 'Selecting a wrong-regulation EO is rejected (got ' + wrongRegSelect.statusCode + ')');
  assert(wrongRegSelect.body.code === 'ELECTIVE_COURSE_WRONG_REGULATION', 'Wrong-regulation select code (got ' + wrongRegSelect.body.code + ')');

  const goodSelect = await select('P10PEC1', ctxA._id);
  assert(goodSelect.statusCode === 201, 'HOD can select a valid EO candidate (got ' + goodSelect.statusCode + ')');

  const dupSelect = await select('P10PEC1', ctxA._id);
  assert(dupSelect.statusCode === 409, 'Duplicate/conflicting selection is rejected (got ' + dupSelect.statusCode + ')');

  const afterSelect = await makeRequest(app, { path: '/api/hod-allocations/elective-selection?academicContextId=' + ctxA._id, headers: hodH });
  assert(afterSelect.body.data.selectedCount === 1, 'The HOD selection is now active (got ' + afterSelect.body.data.selectedCount + ')');
  assert(afterSelect.body.data.selected[0].courseCode === 'P10PEC1', 'Active selection reports the chosen course');
  assert(!!afterSelect.body.data.selected[0].allocationId, 'Selection is traceable to an allocation id');
  assert(!!afterSelect.body.data.selected[0].assignedBy, 'Selection records who decided (auditability)');
  assert(afterSelect.body.data.state === 'ELECTIVE_SELECTION_REQUIRED', 'Still incomplete: more EO slots required than selected');

  console.log('\n-- D: RBAC ------------------------------------------------');

  const tcSelect = await select('P10PEC2', ctxA._id, tcH);
  assert(tcSelect.statusCode === 403, 'TC cannot select an EO course (got ' + tcSelect.statusCode + ')');
  const facSelect = await select('P10PEC2', ctxA._id, facH);
  assert(facSelect.statusCode === 403, 'FACULTY cannot select an EO course (got ' + facSelect.statusCode + ')');
  const anonSelect = await makeRequest(app, {
    method: 'POST',
    path: '/api/hod-allocations',
    body: { academicContextId: String(ctxA._id), courseCode: 'P10PEC2' },
  });
  assert(anonSelect.statusCode === 401, 'Unauthenticated EO selection -> 401 (got ' + anonSelect.statusCode + ')');

  const adminRead = await makeRequest(app, { path: '/api/hod-allocations/elective-selection?academicContextId=' + ctxA._id, headers: adminH });
  assert(adminRead.statusCode === 200, 'ADMIN retains override read access (got ' + adminRead.statusCode + ')');
  const tcRead = await makeRequest(app, { path: '/api/hod-allocations/elective-selection?academicContextId=' + ctxA._id, headers: tcH });
  assert(tcRead.statusCode === 200, 'TC may READ the HOD-approved selection (got ' + tcRead.statusCode + ')');

  console.log('\n-- E: Cross-context isolation ----------------------------');

  await select('P10OEC1', ctxB._id);
  const selA = await electiveService.getActiveElectiveSelection(ctxA._id);
  const selB = await electiveService.getActiveElectiveSelection(ctxB._id);
  assert(selA.selected.length === 1 && selA.selected[0].courseCode === 'P10PEC1', 'Context A keeps its own selection');
  assert(selB.selected.length === 1 && selB.selected[0].courseCode === 'P10OEC1', 'Context B keeps its own selection');
  assert(String(selA.academicContextId) === String(ctxA._id), 'Selection is bound to the exact academicContextId');

  const leak = await HODFacultyAllocation.find({ academicContextId: ctxA._id, courseCode: 'P10OEC1' }).lean();
  assert(leak.length === 0, 'A Context B selection never leaks into Context A');

  console.log('\n-- F: Generation + design context -----------------------');

  const seeded = await AcademicContext.findOne({ department: 'CSE', year: 'III Year', section: 'A' }).lean();
  const seededSel = await electiveService.getActiveElectiveSelection(seeded._id);
  assert(seededSel.selected.length > 0, 'The real seeded III-A cohort already has an HOD EO selection');
  assert(seededSel.selectedCount < 50, 'Active electives are a HOD selection, not the whole EO catalog (got ' + seededSel.selectedCount + ')');

  const seededCands = await electiveService.listElectiveCandidates({ academicContextId: seeded._id });
  const unselected = seededCands.candidates.filter((c) => !c.isSelected);
  assert(unselected.length > 0, 'Unselected EO catalog candidates exist and stay unselected');
  assert(seededSel.selectedCount < seededCands.candidateCount, 'Selected EO courses are a strict subset of the catalog');

  const tcCtx = await makeRequest(app, { path: '/api/timetable/design-context/' + seeded._id, headers: tcH });
  assert([200, 404].indexOf(tcCtx.statusCode) !== -1, 'TC design-context responds for the seeded cohort (got ' + tcCtx.statusCode + ')');

  console.log('\n-- G: Regulation-aware curriculum read ------------------');

  const regList = await makeRequest(app, { path: '/api/regulations', headers: hodH });
  assert(regList.statusCode === 200, 'GET /api/regulations returns 200');
  assert(Array.isArray(regList.body.data) && regList.body.data.length > 0, 'At least one regulation is listed');

  const r22 = await makeRequest(app, { path: '/api/regulations/R22', headers: hodH });
  assert(r22.statusCode === 200, 'GET /api/regulations/R22 returns 200 (got ' + r22.statusCode + ')');
  const missing = await makeRequest(app, { path: '/api/regulations/R17', headers: hodH });
  assert(missing.statusCode === 404, 'GET /api/regulations/R17 -> 404 (got ' + missing.statusCode + ')');

  console.log('\n-- H: Read validation -----------------------------------');

  const noCtx = await makeRequest(app, { path: '/api/hod-allocations/elective-candidates', headers: hodH });
  assert(noCtx.statusCode === 400, 'Missing academicContextId -> 400 (got ' + noCtx.statusCode + ')');
  const badCtx = await makeRequest(app, { path: '/api/hod-allocations/elective-selection?academicContextId=6aba13b47439464f20c4ceee', headers: hodH });
  assert(badCtx.statusCode === 404, 'Unknown context -> 404 (got ' + badCtx.statusCode + ')');
  assert(badCtx.body.code === 'CONTEXT_NOT_FOUND', 'Unknown context code is CONTEXT_NOT_FOUND (got ' + badCtx.body.code + ')');
  const badReg = await makeRequest(app, { path: '/api/hod-allocations/elective-candidates?academicContextId=' + ctxA._id + '&regulation=R17', headers: hodH });
  assert(badReg.statusCode === 404, 'Unsupported regulation filter -> 404 (got ' + badReg.statusCode + ')');
  assert(badReg.body.code === 'REGULATION_NOT_SUPPORTED', 'Unsupported regulation code (got ' + badReg.body.code + ')');

  console.log('\n===============================================================');
  console.log('PHASE 10 EO / REGULATION: ' + passCount + ' PASSED, ' + failCount + ' FAILED');
  console.log('===============================================================\n');
}

(async () => {
  try {
    await runTests();
  } catch (error) {
    failCount++;
    console.error('\n[FATAL] Phase 10 suite aborted:', error && error.message ? error.message : error);
  } finally {
    await cleanup();
    await disconnectDB();
  }
  process.exit(failCount > 0 ? 1 : 0);
})();
