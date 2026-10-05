/**
 * Phase 8 — AcademicContext academic-year range + migration test suite.
 *
 * Covers:
 *   1.  Existing valid context migrates correctly
 *   2.  Migration is idempotent
 *   3.  Context _id is preserved
 *   4.  TimetableVersion references remain valid
 *   5.  TimetableSession references remain valid
 *   6.  from < to enforced
 *   7.  from == to rejected
 *   8.  from > to rejected
 *   9.  incomplete range rejected
 *   10. duplicate context prevented
 *   11. existing contexts remain queryable
 *   12. context-specific timetable lookup still works
 *
 * Isolation: every fixture uses department 'P8TEST', which does not exist in the
 * seeded data, and cleanup only ever deletes records carrying that department.
 * No shared seeded AcademicContext, TimetableVersion or TimetableSession is
 * modified or removed.
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const AcademicContext = require('../src/models/AcademicContext');
const TimetableVersion = require('../src/models/TimetableVersion');
const TimetableSession = require('../src/models/TimetableSession');
const { generateToken } = require('../src/utils/generateToken');
const { migrateAcademicYearRange } = require('../src/migrations/migrateAcademicYearRange');
const {
  parseAcademicYear,
  formatAcademicYear,
  isValidRange,
  resolveAcademicYearRange,
} = require('../src/utils/academicYearRange');

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

// Every fixture is tagged with this department so cleanup can never touch seeded data.
const TEST_DEPT = 'P8TEST';
const hodEmail = 'p8_ctx_hod@nec.edu.in';

async function ctxIds() {
  const rows = await AcademicContext.find({ department: TEST_DEPT }).select('_id').lean();
  return rows.map((r) => r._id);
}

/** Removes only fixtures created by this suite. */
async function cleanup() {
  const ids = await ctxIds();
  await TimetableSession.deleteMany({ academicContextId: { $in: ids } });
  await TimetableVersion.deleteMany({ academicContextId: { $in: ids } });
  await AcademicContext.deleteMany({ department: TEST_DEPT });
  await Faculty.deleteMany({ facultyId: /^P8-FAC/ });
  await User.deleteMany({ email: hodEmail });
}
/**
 * Writes a PRE-PHASE-8 shaped document straight into the collection, bypassing
 * Mongoose validation, so the migration has something real to convert. This is
 * exactly what an existing production record looks like on disk.
 */
async function insertLegacyContext({ academicYear, semester, year, section, status }) {
  const res = await AcademicContext.collection.insertOne({
    academicYear,
    semester,
    department: TEST_DEPT,
    year,
    section,
    program: 'UG',
    status: status || 'ACTIVE',
  });
  return res.insertedId;
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 8: ACADEMIC CONTEXT YEAR RANGE - TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  console.log('\n-- Section 0: Range Helpers -------------------------------');

  assert(isValidRange(2026, 2027), 'from < to is a valid range');
  assert(!isValidRange(2026, 2026), 'from == to is rejected');
  assert(!isValidRange(2027, 2026), 'from > to is rejected');
  assert(!isValidRange(2026, undefined), 'a missing end is rejected');
  assert(!isValidRange(undefined, 2027), 'a missing start is rejected');
  assert(!isValidRange('2026', 2027), 'a non-integer start is rejected');

  assert(formatAcademicYear(2026, 2027) === '2026-27', '2026..2027 formats as 2026-27');
  assert(parseAcademicYear('2026-27').academicYearTo === 2027, "'2026-27' parses to 2026..2027");
  assert(parseAcademicYear('2026/27') === null, 'a slash format is rejected rather than guessed');
  assert(parseAcademicYear('2026') === null, 'a bare year is not a range');
  assert(resolveAcademicYearRange({ academicYear: '2026-27' }).academicYearFrom === 2026, 'legacy string resolves via the shared helper');
  assert(resolveAcademicYearRange({ academicYearFrom: 2026 }) === null, 'a half range does not resolve');

  const hod = await User.findOneAndUpdate(
    { email: hodEmail },
    { $set: { name: 'Phase 8 Context HOD', email: hodEmail, role: 'HOD', isActive: true } },
    { upsert: true, new: true }
  );
  const hodHeaders = { Authorization: `Bearer ${generateToken(hod)}` };

  const seededCountBefore = await AcademicContext.countDocuments({ department: { $ne: TEST_DEPT } });

  const legacyId = await insertLegacyContext({
    academicYear: '2099-00',
    semester: 'Phase8 Semester',
    year: 'VIII Year',
    section: 'L',
  });
  const rawBefore = await AcademicContext.collection.findOne({ _id: legacyId });
  assert(rawBefore.academicYearFrom === undefined, 'Fixture really is pre-migration (no academicYearFrom on disk)');

  const version = await TimetableVersion.create({
    academicContextId: legacyId,
    academicYear: '2099-00',
    semester: 'Phase8 Semester',
    department: TEST_DEPT,
    year: 'VIII Year',
    section: 'L',
    version: 1,
    versionLabel: 'P8-Migration-Version',
    status: 'PUBLISHED',
  });
  const session = await TimetableSession.create({
    timetableVersionId: version._id,
    academicContextId: legacyId,
    courseCode: 'P8C01',
    courseName: 'P8 Course',
    facultyId: 'P8-FAC-01',
    facultyName: 'P8 Faculty',
    day: 'MON',
    period: 'P1',
    room: 'LH-P8',
    sessionType: 'THEORY',
  });
  await Faculty.findOneAndUpdate(
    { facultyId: 'P8-FAC-01' },
    { $set: { facultyName: 'P8 Faculty', designation: 'Assistant Professor', isActive: true } },
    { upsert: true }
  );

  console.log('\n-- Section 1: Migration -----------------------------------');

  const run1 = await migrateAcademicYearRange({ closeConnection: false, silent: true });

  const afterDoc = await AcademicContext.findById(legacyId).lean();
  assert(afterDoc.academicYearFrom === 2099, `Migrated academicYearFrom is 2099 (got ${afterDoc.academicYearFrom})`);
  assert(afterDoc.academicYearTo === 2100, `Migrated academicYearTo is 2100 (got ${afterDoc.academicYearTo})`);
  assert(afterDoc.academicYear === '2099-00', `Legacy mirror preserved (got ${afterDoc.academicYear})`);
  assert(String(afterDoc._id) === String(legacyId), 'Context _id is preserved by the migration');
  assert(run1.before === run1.after, `Record count unchanged (${run1.before} -> ${run1.after})`);
  assert(run1.idsPreserved === true, 'Migration reports every _id preserved');
  assert(run1.unparseable === 0, `No unparseable records (got ${run1.unparseable})`);
  assert(run1.duplicateCandidates.length === 0, `No duplicate contexts created (got ${run1.duplicateCandidates.length})`);

  console.log('\n-- Section 2: Idempotency ----------------------------------');

  const run2 = await migrateAcademicYearRange({ closeConnection: false, silent: true });
  const run3 = await migrateAcademicYearRange({ closeConnection: false, silent: true });

  assert(run2.migrated === 0, `Second run migrates nothing (got ${run2.migrated})`);
  assert(run3.migrated === 0, `Third run migrates nothing (got ${run3.migrated})`);
  assert(run2.before === run2.after, 'Second run leaves the count unchanged');
  assert(run2.alreadyCurrent === run2.before, `Second run reports every record current (${run2.alreadyCurrent}/${run2.before})`);

  const afterDoc2 = await AcademicContext.findById(legacyId).lean();
  assert(afterDoc2.academicYearFrom === 2099 && afterDoc2.academicYearTo === 2100, 'Repeated migration does not drift the range');

  console.log('\n-- Section 3: Reference Integrity -------------------------');

  const versionAfter = await TimetableVersion.findById(version._id).lean();
  const sessionAfter = await TimetableSession.findById(session._id).lean();
  assert(!!versionAfter && String(versionAfter.academicContextId) === String(legacyId), 'TimetableVersion still references the same context');
  assert(!!sessionAfter && String(sessionAfter.academicContextId) === String(legacyId), 'TimetableSession still references the same context');
  assert(sessionAfter.courseCode === 'P8C01' && sessionAfter.room === 'LH-P8', 'TimetableSession payload is untouched');
  assert(sessionAfter.day === 'MON' && sessionAfter.period === 'P1', 'TimetableSession slot is untouched');

  const seededCountAfter = await AcademicContext.countDocuments({ department: { $ne: TEST_DEPT } });
  assert(seededCountBefore === seededCountAfter, `Seeded context count unchanged (${seededCountBefore} -> ${seededCountAfter})`);

  const allContexts = await AcademicContext.find({}).lean();
  const invalid = allContexts.filter((c) => !isValidRange(c.academicYearFrom, c.academicYearTo));
  assert(invalid.length === 0, `All ${allContexts.length} contexts have a valid range (invalid: ${invalid.length})`);
  const mirrored = allContexts.filter((c) => c.academicYear !== formatAcademicYear(c.academicYearFrom, c.academicYearTo));
  assert(mirrored.length === 0, `All ${allContexts.length} contexts have a consistent legacy mirror`);

  console.log('\n-- Section 4: Validation -----------------------------------');

  const mk = (payload) =>
    AcademicContext.create({ semester: 'Phase8 V', department: TEST_DEPT, year: 'VIII Year', program: 'UG', ...payload });

  const fromEqTo = await mk({ section: 'A', academicYearFrom: 2026, academicYearTo: 2026 }).then(() => null, (e) => e);
  assert(!!fromEqTo, 'from == to is rejected by the model');
  const fromGtTo = await mk({ section: 'B', academicYearFrom: 2027, academicYearTo: 2026 }).then(() => null, (e) => e);
  assert(!!fromGtTo, 'from > to is rejected by the model');
  const halfA = await mk({ section: 'C', academicYearFrom: 2026 }).then(() => null, (e) => e);
  assert(!!halfA, 'a missing academicYearTo is rejected by the model');
  const halfB = await mk({ section: 'D', academicYearTo: 2027 }).then(() => null, (e) => e);
  assert(!!halfB, 'a missing academicYearFrom is rejected by the model');
  const malformed = await mk({ section: 'E', academicYear: '2026/27' }).then(() => null, (e) => e);
  assert(!!malformed, 'a malformed academicYear string is rejected by the model');

  const good = await mk({ section: 'F', academicYearFrom: 2030, academicYearTo: 2031 });
  assert(good.academicYearFrom === 2030 && good.academicYearTo === 2031, 'A valid explicit range is accepted');
  assert(good.academicYear === '2030-31', `The legacy mirror is derived (got ${good.academicYear})`);

  console.log('\n-- Section 5: Identity + Duplicate Prevention -------------');

  const dupAttempt = await mk({ section: 'F', academicYearFrom: 2030, academicYearTo: 2031 }).then(() => null, (e) => e);
  assert(!!dupAttempt && dupAttempt.code === 11000, `A duplicate context is rejected (${dupAttempt ? dupAttempt.code : 'none'})`);

  const nextYear = await mk({ section: 'F', academicYearFrom: 2031, academicYearTo: 2032 });
  assert(String(nextYear._id) !== String(good._id), 'The same section in another academic year is a distinct context');

  console.log('\n-- Section 6: API Contract --------------------------------');

  const listRange = await makeRequest(app, { method: 'GET', path: '/api/academic-contexts?department=P8TEST&academicYearFrom=2030&academicYearTo=2031' });
  assert(listRange.statusCode === 200, 'Filtering by an explicit range returns 200');
  assert(listRange.body.data.length === 1 && String(listRange.body.data[0]._id) === String(good._id), 'Range filter selects exactly the matching context');

  const listLegacy = await makeRequest(app, { method: 'GET', path: '/api/academic-contexts?department=P8TEST&academicYear=2030-31' });
  assert(listLegacy.body.data.length === 1 && String(listLegacy.body.data[0]._id) === String(good._id), 'A legacy academicYear filter selects the same context');

  const listBad = await makeRequest(app, { method: 'GET', path: '/api/academic-contexts?department=P8TEST&academicYear=2030/31' });
  assert(listBad.statusCode === 400 && listBad.body.code === 'INVALID_ACADEMIC_YEAR', `Malformed filter -> 400 INVALID_ACADEMIC_YEAR (got ${listBad.statusCode}/${listBad.body.code})`);

  const createBody = {
    academicYearFrom: 2040,
    academicYearTo: 2041,
    semester: 'Phase8 V',
    department: TEST_DEPT,
    year: 'VIII Year',
    section: 'NEW',
    program: 'UG',
  };
  const created = await makeRequest(app, { method: 'POST', path: '/api/academic-contexts', headers: hodHeaders, body: createBody });
  assert(created.statusCode === 201, `POST with an explicit range -> 201 (got ${created.statusCode})`);
  assert(created.body.data.academicYearFrom === 2040 && created.body.data.academicYearTo === 2041, 'Created context persists the canonical range');

  const createDup = await makeRequest(app, { method: 'POST', path: '/api/academic-contexts', headers: hodHeaders, body: createBody });
  assert(createDup.statusCode === 409 && createDup.body.code === 'DUPLICATE_CONTEXT', `Duplicate create -> 409 (got ${createDup.statusCode}/${createDup.body.code})`);

  const createBad = await makeRequest(app, {
    method: 'POST',
    path: '/api/academic-contexts',
    headers: hodHeaders,
    body: { academicYearFrom: 2040, semester: 'Phase8 V', department: TEST_DEPT, year: 'VIII Year', section: 'HALF' },
  });
  assert(createBad.statusCode === 400 && createBad.body.code === 'INVALID_ACADEMIC_YEAR', `Half-range create -> 400 (got ${createBad.statusCode}/${createBad.body.code})`);

  console.log('\n-- Section 7: Context Lookup Still Works ------------------');

  const byId = await makeRequest(app, { method: 'GET', path: `/api/academic-contexts/${good._id}`, headers: hodHeaders });
  assert(byId.statusCode === 200, `GET /api/academic-contexts/:id returns 200 (got ${byId.statusCode})`);
  assert(byId.body.data.academicYearFrom === 2030, 'Fetched context exposes the canonical range');

  const classLookup = await makeRequest(app, { method: 'GET', path: `/api/timetable/class/${good._id}`, headers: hodHeaders });
  assert([200, 404].includes(classLookup.statusCode), `Context-scoped timetable lookup responds deterministically (got ${classLookup.statusCode})`);

  console.log('\n===============================================================');
  console.log(`PHASE 8 ACADEMIC YEAR RANGE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================\n');
}

(async () => {
  try {
    await runTests();
  } catch (error) {
    failCount++;
    console.error('\n[FATAL] Phase 8 year-range suite aborted:', error && error.message ? error.message : error);
  } finally {
    await cleanup();
    await disconnectDB();
  }
  process.exit(failCount > 0 ? 1 : 0);
})();
