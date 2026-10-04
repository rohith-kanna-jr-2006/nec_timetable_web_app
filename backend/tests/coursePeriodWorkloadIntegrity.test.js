/**
 * Phase 11 - Course period / TimetableSession / workload integrity suite.
 *
 * Isolation: fixtures use department 'P11W', course prefix 'P11', faculty prefix
 * 'P11-' and version label prefix 'P11'. Cleanup removes only those records. Shared
 * seeded data (III-A and the rest) is read-only.
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
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const FacultyWorkload = require('../src/models/FacultyWorkload');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const { generateToken } = require('../src/utils/generateToken');
const {
  resolveCourseRequirement,
  validateSessionCounts,
  deriveWorkloadTotals,
  buildWorkloadPayload,
  WORKLOAD_PROTECTED_FIELDS,
} = require('../src/services/courseRequirementService');

const TEST_DEPT = 'P11W';
const emails = { hod: 'p11_hod@nec.edu.in', admin: 'p11_admin@nec.edu.in' };

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
      const req = http.request({ hostname: '127.0.0.1', port, path: opts.path, method: opts.method || 'GET', headers: headers }, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          server.close();
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(raw) }); }
          catch (_) { resolve({ statusCode: res.statusCode, body: raw }); }
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

const createdVersionIds = [];
const createdSessionIds = [];
const createdCourseCodes = [];

async function cleanup() {
  const ctxIds = (await AcademicContext.find({ department: TEST_DEPT }).select('_id').lean()).map((c) => c._id);
  await TimetableSession.deleteMany({ academicContextId: { $in: ctxIds } });
  await TimetableVersion.deleteMany({ academicContextId: { $in: ctxIds } });
  await HODFacultyAllocation.deleteMany({ academicContextId: { $in: ctxIds } });
  await AcademicContext.deleteMany({ department: TEST_DEPT });
  await Course.deleteMany({ courseCode: { $in: createdCourseCodes } });
  await Faculty.deleteMany({ facultyId: /^P11-/ });
  await FacultyWorkload.deleteMany({ facultyId: /^P11-/ });
  await User.deleteMany({ email: { $in: Object.values(emails) } });
}

async function makeUser(email, role) {
  const bcrypt = require('bcryptjs');
  return User.findOneAndUpdate(
    { email },
    { $set: { name: 'Phase 11 ' + role, email: email, role: role, isActive: true, passwordHash: await bcrypt.hash('Seed-Pass-1', 10) } },
    { upsert: true, new: true }
  );
}

async function makeCourse(code, opts) {
  createdCourseCodes.push(code);
  return Course.create(Object.assign({
    courseCode: code,
    courseName: 'Phase 11 ' + code,
    regulation: 'R22',
    semester: 'Semester V',
    category: 'PPCC',
    courseType: 'THEORY',
    L: 3, T: 0, P: 0, totalPeriod: 3,
    department: TEST_DEPT,
    isActive: true,
  }, opts || {}));
}

async function makeContext(section) {
  return AcademicContext.create({
    academicYearFrom: 2097,
    academicYearTo: 2098,
    semester: 'Odd Semester',
    department: TEST_DEPT,
    year: 'III Year',
    section: section,
    program: 'UG',
    status: 'ACTIVE',
  });
}

async function makeVersion(ctx, label, status) {
  const v = await TimetableVersion.create({
    academicContextId: ctx._id,
    academicYear: '2097-98',
    semester: 'Odd Semester',
    department: TEST_DEPT,
    year: 'III Year',
    section: ctx.section,
    version: 1,
    versionLabel: label,
    status: status || 'PUBLISHED',
  });
  createdVersionIds.push(v._id);
  return v;
}

async function makeSessions(version, ctx, rows) {
  const docs = rows.map((r) => ({
    timetableVersionId: version._id,
    academicContextId: ctx._id,
    courseCode: r.courseCode,
    courseName: 'Phase 11 ' + r.courseCode,
    facultyId: r.facultyId,
    facultyName: 'Phase 11 Faculty',
    facultyAssignments: r.facultyAssignments || [],
    day: r.day || 'MON',
    period: r.period,
    room: 'LH-P11',
    sessionType: r.sessionType || 'THEORY',
  }));
  const created = await TimetableSession.insertMany(docs);
  created.forEach((d) => createdSessionIds.push(d._id));
  return created;
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 11: COURSE PERIOD / SESSION / WORKLOAD INTEGRITY');
  console.log('===============================================================\n');

  await connectDB();

  const hod = await makeUser(emails.hod, 'HOD');
  const admin = await makeUser(emails.admin, 'ADMIN');
  const hodH = { Authorization: 'Bearer ' + generateToken(hod) };
  const adminH = { Authorization: 'Bearer ' + generateToken(admin) };

  const ctxA = await makeContext('A');
  const ctxB = await makeContext('B');
  await Faculty.create({ facultyId: 'P11-FAC-1', facultyName: 'Phase 11 Primary', designation: 'Professor', department: TEST_DEPT, isActive: true });

  const theory = await makeCourse('P11THEO1', { L: 3, T: 0, P: 0, totalPeriod: 3 });
  const lab3 = await makeCourse('P11LAB3', { courseType: 'LAB', category: 'PCC', isLab: true, L: 0, T: 0, P: 3, totalPeriod: 3 });
  await makeCourse('P11MC01', { courseType: 'MC', category: 'MC', L: 0, T: 0, P: 0, totalPeriod: 1 });
  await makeCourse('P11EL01', { category: 'PEC', electiveType: 'PEC', semester: 'Programme Elective', L: 3, T: 0, P: 0, totalPeriod: 3 });
  await makeCourse('P11EL02', { category: 'PEC', electiveType: 'PEC', semester: 'Programme Elective', L: 3, T: 0, P: 0, totalPeriod: 3 });
  const noReq = await makeCourse('P11NOREQ', { L: 0, T: 0, P: 0, totalPeriod: 0 });

  console.log('\n-- A: Canonical course requirement ------------------------');

  assert(resolveCourseRequirement(theory).requiredPeriods === 3, 'Theory requirement resolves from totalPeriod');
  assert(resolveCourseRequirement(theory).source === 'TOTAL_PERIOD', 'Theory source is TOTAL_PERIOD');
  assert(resolveCourseRequirement(lab3).requiredPeriods === 3, 'LAB requirement resolves to 3');
  assert(resolveCourseRequirement(lab3).isLab === true, 'LAB is detected as a lab course');
  assert(resolveCourseRequirement({ totalPeriod: 0, L: 2, T: 1, P: 0 }).source === 'LTP_SUM', 'Falls back to L+T+P sum when totalPeriod absent');
  assert(resolveCourseRequirement(noReq).source === 'MISSING', 'A course with no requirement reports MISSING');
  assert(resolveCourseRequirement(noReq).requiredPeriods === 0, 'MISSING requirement invents no period count');
  assert(resolveCourseRequirement(null).source === 'MISSING', 'A null course is handled explicitly, not defaulted');

  const versionA = await makeVersion(ctxA, 'P11-Version-A');
  const versionB = await makeVersion(ctxB, 'P11-Version-B');

  const labRow = { courseCode: 'P11LAB3', facultyId: 'P11-FAC-1', sessionType: 'LAB',
    facultyAssignments: [
      { facultyId: 'P11-FAC-1', facultyName: 'Phase 11 Primary', role: 'PRIMARY' },
      { facultyId: 'P11-FAC-2', facultyName: 'Phase 11 Second', role: 'ADDITIONAL' },
      { facultyId: 'P11-FAC-3', facultyName: 'Phase 11 Third', role: 'OPTIONAL' },
    ] };

  console.log('\n-- B/C/D: Session counts vs requirement ------------------');

  await makeSessions(versionA, ctxA, [
    { courseCode: 'P11THEO1', facultyId: 'P11-FAC-1', period: 'P1' },
    { courseCode: 'P11THEO1', facultyId: 'P11-FAC-1', period: 'P2' },
    { courseCode: 'P11THEO1', facultyId: 'P11-FAC-1', period: 'P3' },
    Object.assign({}, labRow, { period: 'P4' }),
    Object.assign({}, labRow, { period: 'P5' }),
    Object.assign({}, labRow, { period: 'P6' }),
    { courseCode: 'P11MC01', facultyId: 'P11-FAC-1', period: 'P7', sessionType: 'MC',
      facultyAssignments: [
        { facultyId: 'P11-FAC-1', facultyName: 'Phase 11 Primary', role: 'MATHS_BME' },
        { facultyId: 'P11-FAC-4', facultyName: 'Phase 11 English', role: 'ENGLISH' },
      ] },
    { courseCode: 'P11EL01', facultyId: 'P11-FAC-1', period: 'P8' },
    { courseCode: 'P11EL01', facultyId: 'P11-FAC-1', period: 'P9' },
    { courseCode: 'P11EL01', facultyId: 'P11-FAC-1', period: 'P10' },
    { courseCode: 'P11NOREQ', facultyId: 'P11-FAC-1', period: 'P11' },
  ]);

  const report = await validateSessionCounts({ academicContextId: ctxA._id, timetableVersionId: versionA._id });
  const byCode = {};
  report.results.forEach((r) => { byCode[r.courseCode] = r; });

  assert(byCode['P11THEO1'].requiredPeriods === 3 && byCode['P11THEO1'].actualSessions === 3, 'Theory expected periods == generated class sessions');
  assert(byCode['P11THEO1'].matches === true, 'Theory course reports a match');

  assert(byCode['P11LAB3'].requiredPeriods === 3 && byCode['P11LAB3'].actualSessions === 3, 'LAB expected periods == class sessions');
  assert(byCode['P11LAB3'].facultyCount === 3, '3-faculty LAB retains all assignments');
  assert(byCode['P11LAB3'].isMultiFaculty === true, 'LAB is recognised as multi-faculty');
  assert(byCode['P11LAB3'].actualSessions === 3, '3-faculty LAB remains 3 class sessions, NOT 9');
  assert(byCode['P11LAB3'].matches === true, '3-faculty LAB matches its requirement');

  assert(byCode['P11MC01'].actualSessions === 1, 'MC_SAS is one class session per slot');
  assert(byCode['P11MC01'].facultyCount === 2, 'MC_SAS keeps both faculty assignments');
  assert(byCode['P11MC01'].actualSessions === 1 && byCode['P11MC01'].facultyCount === 2, 'Class-session count is NOT multiplied by faculty count');

  assert(byCode['P11EL01'].requiredPeriods === 3 && byCode['P11EL01'].actualSessions === 3, 'Selected elective uses its own requirement');
  assert(!byCode['P11EL02'], 'Unselected elective catalog course has no sessions and no workload');

  console.log('\n-- E: Optional / unmapped behaviour ----------------------');

  assert(byCode['P11NOREQ'].isComplete === false, 'A requirement-less course is reported incomplete, not defaulted');
  assert(report.incompleteRequirements.length >= 1, 'Missing canonical requirements are surfaced');
  assert(report.allMatch === true, 'Courses with a canonical requirement all match');

  console.log('\n-- F/G: Faculty projection + context isolation -----------');

  const proj = await TimetableSession.find({ academicContextId: ctxA._id, timetableVersionId: versionA._id, 'facultyAssignments.facultyId': 'P11-FAC-2' }).lean();
  assert(proj.length === 3, 'A co-assigned faculty sees the shared LAB sessions');
  assert(proj.length === 3, 'Faculty projection does NOT create duplicate class-session workload');

  await makeSessions(versionB, ctxB, [
    { courseCode: 'P11THEO1', facultyId: 'P11-FAC-9', period: 'P1' },
  ]);
  const reportB = await validateSessionCounts({ academicContextId: ctxB._id, timetableVersionId: versionB._id });
  const inA = await TimetableSession.countDocuments({ academicContextId: ctxA._id, facultyId: 'P11-FAC-9' });
  assert(inA === 0, 'Context A workload/sessions never include Context B faculty');
  assert(reportB.results.length === 1, 'Context B reports only its own sessions');
  assert(String(reportB.academicContextId) === String(ctxB._id), 'Validation is bound to the exact academicContextId');

  const crossVersion = await TimetableSession.countDocuments({ academicContextId: ctxA._id, timetableVersionId: versionB._id });
  assert(crossVersion === 0, 'Version B sessions never contribute to Version A');

  console.log('\n-- H: Workload source of truth ----------------------------');

  const wl = await FacultyWorkload.create({
    facultyId: 'P11-FAC-1',
    facultyName: 'Phase 11 Primary',
    designation: 'Professor',
    department: TEST_DEPT,
    teaching: { ugTheory1: [{ category: 'UG Theory 1', courseCode: 'P11THEO1', courseName: 'P11THEO1', hours: 3 }], lab1: [{ category: 'Lab 1', courseCode: 'P11LAB3', courseName: 'P11LAB3', hours: 3 }], pg: [], others: [], ugTheory2: [], lab2: [] },
    responsibilities: [{ category: 'RESPONSIBILITY', role: 'Class Advisor', hours: 2 }],
    calculatedTeachingHours: 6,
    calculatedResponsibilityHours: 2,
    calculatedTotalHours: 8,
    status: 'MATCHED',
  });

  const derived = deriveWorkloadTotals(wl.toObject());
  assert(derived.calculatedTeachingHours === 6, 'Backend derives 6 teaching hours from persisted data');
  assert(derived.calculatedResponsibilityHours === 2, 'Backend derives 2 responsibility hours');
  assert(derived.calculatedTotalHours === 8, 'Backend derives 8 total hours');
  assert(derived.calculatedTotalHours === wl.calculatedTotalHours, 'Derived total matches the stored total');

  // A client cannot supply the authoritative figures.
  let protectedErr = null;
  try {
    buildWorkloadPayload({ calculatedTotalHours: 999, teaching: { ugTheory1: [] } });
  } catch (e) {
    protectedErr = e;
  }
  assert(!!protectedErr, 'Client-supplied workload totals are rejected');
  assert(protectedErr && protectedErr.code === 'WORKLOAD_FIELD_PROTECTED', 'Rejection code is WORKLOAD_FIELD_PROTECTED');
  assert(protectedErr && protectedErr.details.attempted.length === 2, 'Both protected fields are reported');

  let totalErr = null;
  try {
    buildWorkloadPayload({ calculatedTotalHours: 5 });
  } catch (e) {
    totalErr = e;
  }
  assert(!!totalErr, 'A client cannot override calculatedTotalHours alone');

  const okPayload = buildWorkloadPayload({ sourceTotalHours: 8 });
  assert(okPayload.sourceTotalHours === 8, 'sourceTotalHours is accepted as reference data');
  assert(!('calculatedTotalHours' in okPayload), 'No calculated field leaks into an accepted payload');

  const wlRes = await makeRequest(app, { path: '/api/workload/P11-FAC-1', headers: hodH });
  assert(wlRes.statusCode === 200, 'Workload read endpoint returns 200 (got ' + wlRes.statusCode + ')');
  const wlData = wlRes.body.data || {};
  assert(wlData.calculatedTotalHours === 8, 'API workload total is the backend value (got ' + wlData.calculatedTotalHours + ')');

  console.log('\n-- I: Whole-CSE (multiple real contexts) ------------------');

  const realContexts = await AcademicContext.find({ department: { $ne: TEST_DEPT }, status: 'ACTIVE' }).lean();
  assert(realContexts.length >= 4, 'Multiple real AcademicContexts available for cross-checking (got ' + realContexts.length + ')');

  // Walk every real context that has a timetable holding sessions, so the check
  // is genuinely department-wide rather than a single-cohort proof.
  const distinctContexts = new Set();
  let checked = 0;
  let labSeen = 0;
  let multiFacultySeen = 0;
  for (const ctx of realContexts) {
    const versions = await TimetableVersion.find({ academicContextId: ctx._id }).lean();
    for (const version of versions) {
      const sessionCount = await TimetableSession.countDocuments({ timetableVersionId: version._id });
      if (sessionCount === 0) continue;
      const r = await validateSessionCounts({ academicContextId: ctx._id, timetableVersionId: version._id });
      if (r.courseCount === 0) continue;
      distinctContexts.add(String(ctx._id));
      checked++;
      r.results.forEach((row) => {
        if (row.sessionType === 'LAB') labSeen++;
        if (row.isMultiFaculty) multiFacultySeen++;
      });
    }
  }
  console.log('      [evidence] real contexts validated: ' + distinctContexts.size + ' | versions checked: ' + checked + ' | LAB rows: ' + labSeen + ' | multi-faculty rows: ' + multiFacultySeen);
  assert(distinctContexts.size >= 2, 'At least two distinct real contexts were actually validated (got ' + distinctContexts.size + ')');
  assert(checked >= 3, 'Multiple real timetable versions were validated (got ' + checked + ')');
  assert(labSeen >= 1, 'At least one real LAB course/session was exercised');
  assert(multiFacultySeen >= 1, 'At least one real multi-faculty session was exercised');

  console.log('\n===============================================================');
  console.log('PHASE 11 INTEGRITY: ' + passCount + ' PASSED, ' + failCount + ' FAILED');
  console.log('===============================================================\n');
}

(async () => {
  try {
    await runTests();
  } catch (error) {
    failCount++;
    console.error('\n[FATAL] Phase 11 suite aborted:', error && error.message ? error.message : error);
  } finally {
    await cleanup();
    await disconnectDB();
  }
  process.exit(failCount > 0 ? 1 : 0);
})();
