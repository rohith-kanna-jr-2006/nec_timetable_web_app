/**
 * R22 CSE Curriculum Test Suite
 *
 * Validates:
 * 1. MongoDB Course collection contains exactly 109 R22 UG courses and 10 PG courses
 * 2. Semester course distribution matches docs/R22_CSE_2024_25_Onwards_Semester_Details.md
 * 3. PEC Verticals (I-VI) count is 48
 * 4. Management Electives count is 4
 * 5. Open Electives count is 2
 * 6. Critical course attributes: 22GED01, 22GED02, 22GEZ01, 22CSX21
 * 7. Obsolete mock courses (26CSC01, 26CSP01) are absent and remapped in references
 * 8. Seed idempotency (running seed creates no duplicates)
 * 9. Course APIs (list, detail, regulation, category, semester, vertical, search)
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const Course = require('../src/models/Course');
const FacultyWorkload = require('../src/models/FacultyWorkload');
const TimetableSession = require('../src/models/TimetableSession');
const { seedCourses } = require('../src/seeds/seedCourses');
const {
  R22_CSE_CURRICULUM_COURSES,
  R22_PEC_VERTICALS,
  R22_MANAGEMENT_ELECTIVES,
  R22_OPEN_ELECTIVES,
} = require('../src/data/r22CurriculumMaster');

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
          path,
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
            } catch (e) {
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

async function runR22CurriculumTests() {
  console.log('============================================================');
  console.log('R22 CSE CURRICULUM & DATABASE MIGRATION TEST SUITE');
  console.log('============================================================\n');

  try {
    await connectDB();

    // 1. Total counts verification
    console.log('--- 1. Course Dataset & Category Distribution Checks ---');
    const totalCourses = await Course.countDocuments({ isActive: true });
    const r22UgCourses = await Course.find({ isR22UG: true, isActive: true }).lean();
    const pgCourses = await Course.find({ isR22UG: false, isActive: true }).lean();

    assert(r22UgCourses.length === 109, `Exactly 109 official R22 CSE UG courses found in DB (got: ${r22UgCourses.length})`);
    assert(pgCourses.length === 10, `Exactly 10 preserved PG workload courses found in DB (got: ${pgCourses.length})`);
    assert(totalCourses === 119, `Total active courses count is 119 (109 UG + 10 PG) (got: ${totalCourses})`);

    // 2. Regulation & Curriculum Year verification
    console.log('\n--- 2. Regulation & Curriculum Year Integrity ---');
    const nonR22Count = await Course.countDocuments({ isR22UG: true, regulation: { $ne: 'R22' } });
    assert(nonR22Count === 0, `All R22 UG courses have regulation 'R22' (violations: ${nonR22Count})`);

    const contaminatedYearCount = await Course.countDocuments({ isR22UG: true, academicYear: '2026-27' });
    assert(contaminatedYearCount === 0, `Zero R22 UG courses contaminated with legacy '2026-27' academicYear (got: ${contaminatedYearCount})`);

    const validCurriculumYearCount = await Course.countDocuments({ isR22UG: true, curriculumYear: '2024-25 onwards' });
    assert(validCurriculumYearCount === 109, `All 109 R22 UG courses have curriculumYear '2024-25 onwards' (got: ${validCurriculumYearCount})`);

    // 3. Semester distribution checks
    console.log('\n--- 3. Semester Breakdown Verification ---');
    const sem1 = await Course.countDocuments({ isR22UG: true, semester: 'Semester I' });
    const sem2 = await Course.countDocuments({ isR22UG: true, semester: 'Semester II' });
    const sem3 = await Course.countDocuments({ isR22UG: true, semester: 'Semester III' });
    const sem4 = await Course.countDocuments({ isR22UG: true, semester: 'Semester IV' });
    const sem5Core = await Course.countDocuments({ isR22UG: true, semester: 'Semester V' });
    const sem6Core = await Course.countDocuments({ isR22UG: true, semester: 'Semester VI', electiveType: null });
    const sem7Core = await Course.countDocuments({ isR22UG: true, semester: 'Semester VII' });
    const sem8Core = await Course.countDocuments({ isR22UG: true, semester: 'Semester VIII' });

    assert(sem1 === 11, `Semester I has exactly 11 courses (got: ${sem1})`);
    assert(sem2 === 11, `Semester II has exactly 11 courses (got: ${sem2})`);
    assert(sem3 === 10, `Semester III has exactly 10 courses (got: ${sem3})`);
    assert(sem4 === 10, `Semester IV has exactly 10 courses (got: ${sem4})`);
    assert(sem5Core === 6, `Semester V has exactly 6 core courses (got: ${sem5Core})`);
    assert(sem6Core === 4, `Semester VI has exactly 4 core courses (got: ${sem6Core})`);
    assert(sem7Core === 2, `Semester VII has exactly 2 core courses (got: ${sem7Core})`);
    assert(sem8Core === 1, `Semester VIII has exactly 1 core course (got: ${sem8Core})`);

    // 4. Electives & Verticals distribution checks
    console.log('\n--- 4. Electives & Verticals Verification ---');
    const pecCourses = await Course.find({ isR22UG: true, electiveType: 'PEC' }).lean();
    assert(pecCourses.length === 48, `Exactly 48 PEC courses in database (got: ${pecCourses.length})`);

    const verticals = Object.keys(R22_PEC_VERTICALS);
    assert(verticals.length === 6, `Exactly 6 PEC verticals defined in master (got: ${verticals.length})`);

    for (const vert of verticals) {
      const vCount = await Course.countDocuments({ isR22UG: true, vertical: vert });
      assert(vCount === 8, `Vertical '${vert}' has exactly 8 courses (got: ${vCount})`);
    }

    const mgmtCourses = await Course.find({ isR22UG: true, electiveType: 'Management Elective' }).lean();
    assert(mgmtCourses.length === 4, `Exactly 4 Management Elective courses (got: ${mgmtCourses.length})`);

    const oecCourses = await Course.find({ isR22UG: true, electiveType: 'OEC' }).lean();
    assert(oecCourses.length === 2, `Exactly 2 Open Elective courses (got: ${oecCourses.length})`);

    // 5. Critical Course Attribute Validation
    console.log('\n--- 5. Critical Course Values Verification ---');
    const ged01 = await Course.findOne({ courseCode: '22GED01' });
    assert(ged01 !== null, '22GED01 exists in database');
    assert(ged01.contactPeriod === '0 (0-0-0)', `22GED01 contactPeriod is '0 (0-0-0)' (got: '${ged01.contactPeriod}')`);
    assert(ged01.totalPeriod === 0, `22GED01 totalPeriod is 0 (got: ${ged01.totalPeriod})`);
    assert(ged01.credits === 0, `22GED01 credits is 0 (got: ${ged01.credits})`);

    const ged02 = await Course.findOne({ courseCode: '22GED02' });
    assert(ged02 !== null, '22GED02 exists in database');
    assert(ged02.contactPeriod === '0 (0-0-0)', `22GED02 contactPeriod is '0 (0-0-0)' (got: '${ged02.contactPeriod}')`);
    assert(ged02.totalPeriod === 0, `22GED02 totalPeriod is 0 (got: ${ged02.totalPeriod})`);
    assert(ged02.credits === 0, `22GED02 credits is 0 (got: ${ged02.credits})`);

    const gez01 = await Course.findOne({ courseCode: '22GEZ01' });
    assert(gez01 !== null, '22GEZ01 exists in database');
    assert(gez01.contactPeriod === '4 (2-0-2)', `22GEZ01 contactPeriod is '4 (2-0-2)' (got: '${gez01.contactPeriod}')`);
    assert(gez01.totalPeriod === 4, `22GEZ01 totalPeriod is 4 (got: ${gez01.totalPeriod})`);
    assert(gez01.L === 2 && gez01.T === 0 && gez01.P === 2, `22GEZ01 L-T-P is 2-0-2 (got: L=${gez01.L}, T=${gez01.T}, P=${gez01.P})`);

    const csx21 = await Course.findOne({ courseCode: '22CSX21' });
    assert(csx21 !== null, '22CSX21 exists in database');
    assert(csx21.prerequisite === '22CSC06', `22CSX21 prerequisite is '22CSC06' (got: '${csx21.prerequisite}')`);
    assert(csx21.vertical === 'Cyber Security', `22CSX21 vertical is 'Cyber Security' (got: '${csx21.vertical}')`);

    // 6. Obsolete Mock Codes & Reference Integrity
    console.log('\n--- 6. Obsolete Mock Codes Absence & Reference Integrity ---');
    const oldCodes = await Course.find({ courseCode: { $in: ['26CSC01', '26CSP01'] } });
    assert(oldCodes.length === 0, `Zero mock codes ('26CSC01', '26CSP01') in Course collection (got: ${oldCodes.length})`);

    const workloads = await FacultyWorkload.find({}).lean();
    let oldWlRefs = 0;
    let new22CSC01Refs = 0;
    let new22CSP01Refs = 0;
    workloads.forEach((w) => {
      const s = JSON.stringify(w);
      if (s.includes('26CSC01') || s.includes('26CSP01')) oldWlRefs++;
      if (s.includes('22CSC01')) new22CSC01Refs++;
      if (s.includes('22CSP01')) new22CSP01Refs++;
    });
    assert(oldWlRefs === 0, `Zero mock codes ('26CSC01', '26CSP01') in FacultyWorkload documents (got: ${oldWlRefs})`);
    assert(new22CSC01Refs > 0, `Authoritative '22CSC01' successfully remapped in FacultyWorkload (matches: ${new22CSC01Refs})`);
    assert(new22CSP01Refs > 0, `Authoritative '22CSP01' successfully remapped in FacultyWorkload (matches: ${new22CSP01Refs})`);

    // 7. Seed Idempotency
    console.log('\n--- 7. Seed Idempotency Check ---');
    const resIdempotent = await seedCourses();
    assert(resIdempotent.totalCourses === 119, `Second seed pass preserves 119 total courses (got: ${resIdempotent.totalCourses})`);
    assert(resIdempotent.r22UgCount === 109, `Second seed pass preserves 109 R22 UG courses (got: ${resIdempotent.r22UgCount})`);
    assert(resIdempotent.pgCount === 10, `Second seed pass preserves 10 PG courses (got: ${resIdempotent.pgCount})`);

    // 8. Course APIs
    console.log('\n--- 8. Course API Verification ---');
    // List all
    const resList = await makeRequest(app, { method: 'GET', path: '/api/courses?limit=100' });
    assert(resList.statusCode === 200, 'GET /api/courses returns HTTP 200');
    assert(resList.body.data.pagination.total === 119, `GET /api/courses returns total 119 items (got: ${resList.body.data.pagination?.total})`);

    // Filter regulation=R22
    const resR22 = await makeRequest(app, { method: 'GET', path: '/api/courses?regulation=R22&limit=100' });
    assert(resR22.statusCode === 200, 'GET /api/courses?regulation=R22 returns HTTP 200');
    assert(resR22.body.data.pagination.total === 109, `GET /api/courses?regulation=R22 returns 109 items (got: ${resR22.body.data.pagination?.total})`);

    // Filter semester=Semester V
    const resSem5 = await makeRequest(app, { method: 'GET', path: '/api/courses?semester=Semester%20V' });
    assert(resSem5.statusCode === 200, 'GET /api/courses?semester=Semester%20V returns HTTP 200');
    assert(resSem5.body.data.pagination.total === 6, `GET /api/courses?semester=Semester%20V returns 6 core courses (got: ${resSem5.body.data.pagination?.total})`);

    // Filter electiveType=PEC
    const resPec = await makeRequest(app, { method: 'GET', path: '/api/courses?electiveType=PEC&limit=100' });
    assert(resPec.statusCode === 200, 'GET /api/courses?electiveType=PEC returns HTTP 200');
    assert(resPec.body.data.pagination.total === 48, `GET /api/courses?electiveType=PEC returns 48 items (got: ${resPec.body.data.pagination?.total})`);

    // Filter vertical
    const resVert = await makeRequest(app, { method: 'GET', path: '/api/courses?vertical=Machine%20Intelligence' });
    assert(resVert.statusCode === 200, 'GET /api/courses?vertical=Machine Intelligence returns HTTP 200');
    assert(resVert.body.data.pagination.total === 8, `GET /api/courses?vertical=Machine Intelligence returns 8 courses (got: ${resVert.body.data.pagination?.total})`);

    // Detail by code
    const resDetail = await makeRequest(app, { method: 'GET', path: '/api/courses/22CSC14' });
    assert(resDetail.statusCode === 200, 'GET /api/courses/22CSC14 returns HTTP 200');
    assert(resDetail.body.data.courseName === 'Principles of Compiler Design', `22CSC14 courseName is 'Principles of Compiler Design' (got: '${resDetail.body.data.courseName}')`);
    assert(resDetail.body.data.prerequisite === '22CSC10', `22CSC14 prerequisite is '22CSC10' (got: '${resDetail.body.data.prerequisite}')`);

    // 404 on obsolete code
    const res404 = await makeRequest(app, { method: 'GET', path: '/api/courses/26CSC01' });
    assert(res404.statusCode === 404, 'GET /api/courses/26CSC01 returns HTTP 404 (Obsolete code cleanly absent)');

    console.log('\n============================================================');
    console.log(`R22 CURRICULUM TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    await disconnectDB();

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Test suite failed with error:', error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runR22CurriculumTests();
}

module.exports = { runR22CurriculumTests };
