/**
 * Academic Regulation & R22 Curriculum Data Integrity Test Suite
 *
 * Implements verification for Section 22 (TEST 1 to TEST 20):
 * - TEST 1: R22 curriculum seed produces expected Semester III courses (count: 10)
 * - TEST 2: R22 curriculum seed produces expected Semester V courses (count: 6 core)
 * - TEST 3: R22 curriculum seed produces expected Semester VII courses (count: 2 core)
 * - TEST 4: Course names match authoritative source
 * - TEST 5: Course codes match authoritative source
 * - TEST 6: Course categories match authoritative source
 * - TEST 7: Prerequisites match authoritative source
 * - TEST 8: Contact period matches authoritative source
 * - TEST 9: L-T-P matches authoritative source
 * - TEST 10: Total period matches authoritative source
 * - TEST 11: II-A context returns Semester III courses (count: 10)
 * - TEST 12: III-A context returns Semester V courses (count: 6)
 * - TEST 13: IV-A context returns Semester VII courses (count: 2)
 * - TEST 14: II-B context returns Semester III courses (count: 10)
 * - TEST 15: III-B context returns Semester V courses (count: 6)
 * - TEST 16: IV-B context returns Semester VII courses (count: 2)
 * - TEST 17: No duplicate courseCode records are introduced
 * - TEST 18: Repeated seed execution is idempotent
 * - TEST 19: Pagination does not hide Semester V/VII records
 * - TEST 20: Course name does not contain accidental "(PSE)" / "(PBL)"
 *
 * Additional verification:
 * - Read-only Regulation API endpoints (/api/regulation/current, /api/regulations)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const Course = require('../src/models/Course');
const AcademicContext = require('../src/models/AcademicContext');
const { seedCourses } = require('../src/seeds/seedCourses');

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

function parseAuthoritativeMarkdown() {
  const possiblePaths = [
    path.resolve(__dirname, '../../R22_CSE_2024_25_Onwards_Semester_Details.md'),
    path.resolve(__dirname, '../docs/R22_CSE_2024_25_Onwards_Semester_Details.md'),
    path.resolve(__dirname, '../../docs/R22_CSE_2024_25_Onwards_Semester_Details.md'),
  ];

  let doc = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      doc = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  if (!doc) {
    throw new Error('Authoritative R22 Markdown document not found');
  }

  const lines = doc.split('\n');
  let currentSemester = null;
  const expectedCourses = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# Semester ')) {
      currentSemester = line.replace('# ', '').trim();
    } else if (line.startsWith('# Management Electives')) {
      currentSemester = 'Semester VI';
    } else if (line.startsWith('# Open Elective Courses')) {
      currentSemester = 'Open Elective';
    }

    if (line.startsWith('|') && !line.includes('Course Code') && !line.includes('---|')) {
      const parts = line.split('|').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 6) {
        const code = parts[0];
        if (code.startsWith('E') && code.length <= 3) {
          // Elective slot placeholder
          continue;
        }

        // Parse L-T-P from Contact Period e.g. "4 (2-0-2)" or "3 (3-0-0)" or "-"
        let l = 0, t = 0, p = 0;
        const ltpMatch = parts[4].match(/\((\d+)-(\d+)-(\d+)\)/);
        if (ltpMatch) {
          l = parseInt(ltpMatch[1], 10);
          t = parseInt(ltpMatch[2], 10);
          p = parseInt(ltpMatch[3], 10);
        }

        const totalPeriod = parts[5] === '-' ? 0 : parseInt(parts[5], 10);

        expectedCourses.push({
          courseCode: code,
          courseName: parts[1],
          category: parts[2],
          prerequisite: parts[3] === '-' ? '-' : parts[3],
          contactPeriod: parts[4],
          totalPeriod,
          L: l,
          T: t,
          P: p,
          semester: currentSemester,
        });
      }
    }
  }

  return expectedCourses;
}

async function runAcademicRegulationTests() {
  console.log('============================================================');
  console.log('ACADEMIC REGULATION & R22 CURRICULUM INTEGRITY TEST SUITE');
  console.log('============================================================\n');

  try {
    await connectDB();

    const expectedCourses = parseAuthoritativeMarkdown();
    const authoritativeMap = new Map();
    expectedCourses.forEach((c) => authoritativeMap.set(c.courseCode, c));

    // TEST 1
    console.log('--- TEST 1: R22 curriculum seed produces expected Semester III courses ---');
    const sem3Courses = await Course.find({ isR22UG: true, semester: 'Semester III' }).sort({ courseCode: 1 });
    assert(sem3Courses.length === 10, `TEST 1: Exactly 10 Semester III courses found (got: ${sem3Courses.length})`);

    // TEST 2
    console.log('\n--- TEST 2: R22 curriculum seed produces expected Semester V courses ---');
    const sem5Courses = await Course.find({ isR22UG: true, semester: 'Semester V' }).sort({ courseCode: 1 });
    assert(sem5Courses.length === 6, `TEST 2: Exactly 6 Semester V core courses found (got: ${sem5Courses.length})`);

    // TEST 3
    console.log('\n--- TEST 3: R22 curriculum seed produces expected Semester VII courses ---');
    const sem7Courses = await Course.find({ isR22UG: true, semester: 'Semester VII' }).sort({ courseCode: 1 });
    assert(sem7Courses.length === 2, `TEST 3: Exactly 2 Semester VII core courses found (got: ${sem7Courses.length})`);

    // Fetch all active courses for source-of-truth comparison
    const dbCourses = await Course.find({ isR22UG: true, isActive: true }).lean();
    const dbMap = new Map();
    dbCourses.forEach((c) => dbMap.set(c.courseCode, c));

    // TEST 4
    console.log('\n--- TEST 4: Course names match authoritative source ---');
    let nameMismatches = 0;
    expectedCourses.forEach((exp) => {
      const dbCourse = dbMap.get(exp.courseCode);
      if (!dbCourse || dbCourse.courseName !== exp.courseName) {
        nameMismatches++;
        console.error(`  Mismatch on name: code=${exp.courseCode}, exp="${exp.courseName}", db="${dbCourse?.courseName}"`);
      }
    });
    assert(nameMismatches === 0, `TEST 4: All course names match authoritative source (mismatches: ${nameMismatches})`);

    // TEST 5
    console.log('\n--- TEST 5: Course codes match authoritative source ---');
    let codeMismatches = 0;
    expectedCourses.forEach((exp) => {
      if (!dbMap.has(exp.courseCode)) {
        codeMismatches++;
        console.error(`  Missing code in DB: ${exp.courseCode}`);
      }
    });
    assert(codeMismatches === 0, `TEST 5: All course codes match authoritative source (missing: ${codeMismatches})`);

    // TEST 6
    console.log('\n--- TEST 6: Course categories match authoritative source ---');
    let categoryMismatches = 0;
    expectedCourses.forEach((exp) => {
      const dbCourse = dbMap.get(exp.courseCode);
      if (dbCourse && dbCourse.category !== exp.category) {
        categoryMismatches++;
        console.error(`  Category mismatch: code=${exp.courseCode}, exp="${exp.category}", db="${dbCourse.category}"`);
      }
    });
    assert(categoryMismatches === 0, `TEST 6: All course categories match authoritative source (mismatches: ${categoryMismatches})`);

    // TEST 7
    console.log('\n--- TEST 7: Prerequisites match authoritative source ---');
    let prereqMismatches = 0;
    expectedCourses.forEach((exp) => {
      const dbCourse = dbMap.get(exp.courseCode);
      const dbPrereq = dbCourse?.prerequisite || '-';
      if (dbCourse && dbPrereq !== exp.prerequisite) {
        prereqMismatches++;
        console.error(`  Prerequisite mismatch: code=${exp.courseCode}, exp="${exp.prerequisite}", db="${dbPrereq}"`);
      }
    });
    assert(prereqMismatches === 0, `TEST 7: All prerequisites match authoritative source (mismatches: ${prereqMismatches})`);

    // TEST 8
    console.log('\n--- TEST 8: Contact period matches authoritative source ---');
    let contactMismatches = 0;
    expectedCourses.forEach((exp) => {
      const dbCourse = dbMap.get(exp.courseCode);
      if (exp.contactPeriod !== '-' && dbCourse && dbCourse.contactPeriod !== exp.contactPeriod) {
        contactMismatches++;
        console.error(`  Contact period mismatch: code=${exp.courseCode}, exp="${exp.contactPeriod}", db="${dbCourse.contactPeriod}"`);
      }
    });
    assert(contactMismatches === 0, `TEST 8: All contact periods match authoritative source (mismatches: ${contactMismatches})`);

    // TEST 9
    console.log('\n--- TEST 9: L-T-P matches authoritative source ---');
    let ltpMismatches = 0;
    expectedCourses.forEach((exp) => {
      const dbCourse = dbMap.get(exp.courseCode);
      if (exp.contactPeriod !== '-' && dbCourse) {
        if (dbCourse.L !== exp.L || dbCourse.T !== exp.T || dbCourse.P !== exp.P) {
          ltpMismatches++;
          console.error(`  L-T-P mismatch: code=${exp.courseCode}, exp=${exp.L}-${exp.T}-${exp.P}, db=${dbCourse.L}-${dbCourse.T}-${dbCourse.P}`);
        }
      }
    });
    assert(ltpMismatches === 0, `TEST 9: All L-T-P distributions match authoritative source (mismatches: ${ltpMismatches})`);

    // TEST 10
    console.log('\n--- TEST 10: Total period matches authoritative source ---');
    let totalPeriodMismatches = 0;
    expectedCourses.forEach((exp) => {
      const dbCourse = dbMap.get(exp.courseCode);
      if (dbCourse && (dbCourse.totalPeriod || 0) !== exp.totalPeriod) {
        totalPeriodMismatches++;
        console.error(`  Total period mismatch: code=${exp.courseCode}, exp=${exp.totalPeriod}, db=${dbCourse.totalPeriod}`);
      }
    });
    assert(totalPeriodMismatches === 0, `TEST 10: All total periods match authoritative source (mismatches: ${totalPeriodMismatches})`);

    // Fetch Academic Contexts for Section A & B testing
    const ctxII_A = await AcademicContext.findOne({ year: /^II Year$/i, section: 'A' });
    const ctxIII_A = await AcademicContext.findOne({ year: /^III Year$/i, section: 'A' });
    const ctxIV_A = await AcademicContext.findOne({ year: /^IV Year$/i, section: 'A' });
    const ctxII_B = await AcademicContext.findOne({ year: /^II Year$/i, section: 'B' });
    const ctxIII_B = await AcademicContext.findOne({ year: /^III Year$/i, section: 'B' });
    const ctxIV_B = await AcademicContext.findOne({ year: /^IV Year$/i, section: 'B' });

    // TEST 11
    console.log('\n--- TEST 11: II-A context returns Semester III courses ---');
    const resII_A = await makeRequest(app, { method: 'GET', path: `/api/courses?academicContextId=${ctxII_A._id}` });
    assert(resII_A.statusCode === 200, 'II-A request succeeded with HTTP 200');
    assert(resII_A.body.data.pagination.total === 10, `TEST 11: II-A returns exactly 10 Semester III courses (got: ${resII_A.body.data.pagination.total})`);

    // TEST 12
    console.log('\n--- TEST 12: III-A context returns Semester V courses ---');
    const resIII_A = await makeRequest(app, { method: 'GET', path: `/api/courses?academicContextId=${ctxIII_A._id}` });
    assert(resIII_A.statusCode === 200, 'III-A request succeeded with HTTP 200');
    assert(resIII_A.body.data.pagination.total === 6, `TEST 12: III-A returns exactly 6 Semester V courses (got: ${resIII_A.body.data.pagination.total})`);

    // TEST 13
    console.log('\n--- TEST 13: IV-A context returns Semester VII courses ---');
    const resIV_A = await makeRequest(app, { method: 'GET', path: `/api/courses?academicContextId=${ctxIV_A._id}` });
    assert(resIV_A.statusCode === 200, 'IV-A request succeeded with HTTP 200');
    assert(resIV_A.body.data.pagination.total === 2, `TEST 13: IV-A returns exactly 2 Semester VII courses (got: ${resIV_A.body.data.pagination.total})`);

    // TEST 14
    console.log('\n--- TEST 14: II-B context returns Semester III courses ---');
    const resII_B = await makeRequest(app, { method: 'GET', path: `/api/courses?academicContextId=${ctxII_B._id}` });
    assert(resII_B.statusCode === 200, 'II-B request succeeded with HTTP 200');
    assert(resII_B.body.data.pagination.total === 10, `TEST 14: II-B returns exactly 10 Semester III courses (got: ${resII_B.body.data.pagination.total})`);

    // TEST 15
    console.log('\n--- TEST 15: III-B context returns Semester V courses ---');
    const resIII_B = await makeRequest(app, { method: 'GET', path: `/api/courses?academicContextId=${ctxIII_B._id}` });
    assert(resIII_B.statusCode === 200, 'III-B request succeeded with HTTP 200');
    assert(resIII_B.body.data.pagination.total === 6, `TEST 15: III-B returns exactly 6 Semester V courses (got: ${resIII_B.body.data.pagination.total})`);

    // TEST 16
    console.log('\n--- TEST 16: IV-B context returns Semester VII courses ---');
    const resIV_B = await makeRequest(app, { method: 'GET', path: `/api/courses?academicContextId=${ctxIV_B._id}` });
    assert(resIV_B.statusCode === 200, 'IV-B request succeeded with HTTP 200');
    assert(resIV_B.body.data.pagination.total === 2, `TEST 16: IV-B returns exactly 2 Semester VII courses (got: ${resIV_B.body.data.pagination.total})`);

    // TEST 17
    console.log('\n--- TEST 17: No duplicate courseCode records are introduced ---');
    const duplicateAggregation = await Course.aggregate([
      { $group: { _id: '$courseCode', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    assert(duplicateAggregation.length === 0, `TEST 17: Zero duplicate courseCodes found (duplicates: ${duplicateAggregation.length})`);

    // TEST 18
    console.log('\n--- TEST 18: Repeated seed execution is idempotent ---');
    const beforeCount = await Course.countDocuments();
    await seedCourses();
    const afterCount = await Course.countDocuments();
    assert(beforeCount === afterCount, `TEST 18: Repeated seed is idempotent (${beforeCount} -> ${afterCount})`);

    // TEST 19
    console.log('\n--- TEST 19: Pagination does not hide Semester V/VII records ---');
    // Default GET /api/courses without limit parameter returns all 119 records
    const resUnpaginated = await makeRequest(app, { method: 'GET', path: '/api/courses' });
    assert(resUnpaginated.body.data.items.length === 119, `TEST 19: GET /api/courses returns all 119 records without truncation (got: ${resUnpaginated.body.data.items.length})`);
    const sem5Included = resUnpaginated.body.data.items.some((c) => c.courseCode === '22CSC14');
    const sem7Included = resUnpaginated.body.data.items.some((c) => c.courseCode === '22GEA01');
    assert(sem5Included && sem7Included, 'TEST 19: Both Semester V (22CSC14) and Semester VII (22GEA01) are present in catalog');

    // TEST 20
    console.log('\n--- TEST 20: Course name does not contain accidental "(PSE)" / "(PBL)" ---');
    const contaminatedCourses = await Course.find({
      $or: [
        { courseName: { $regex: /\(PSE\)/i } },
        { courseName: { $regex: /\(PBL\)/i } },
      ],
    }).lean();
    assert(contaminatedCourses.length === 0, `TEST 20: Zero courses contain accidental "(PSE)" or "(PBL)" in courseName (got: ${contaminatedCourses.length})`);

    // Additional: Read-Only Regulation API verification
    console.log('\n--- BONUS: Dedicated Read-Only Regulation API Endpoints ---');
    const resRegCurrent = await makeRequest(app, { method: 'GET', path: '/api/regulation/current' });
    assert(resRegCurrent.statusCode === 200, 'GET /api/regulation/current returns HTTP 200');
    assert(resRegCurrent.body.data.regulationCode === 'R22', `Regulation code is 'R22' (got: '${resRegCurrent.body.data.regulationCode}')`);
    assert(resRegCurrent.body.data.curriculumCode === 'R22-CSE', `Curriculum code is 'R22-CSE' (got: '${resRegCurrent.body.data.curriculumCode}')`);
    assert(resRegCurrent.body.data.totalCourses === 109, `R22 regulation course count is 109 (got: ${resRegCurrent.body.data.totalCourses})`);

    const resRegList = await makeRequest(app, { method: 'GET', path: '/api/regulations' });
    assert(resRegList.statusCode === 200, 'GET /api/regulations returns HTTP 200');
    assert(resRegList.body.data.length === 1, 'GET /api/regulations returns active regulation list');

    console.log('\n============================================================');
    console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
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
  runAcademicRegulationTests();
}

module.exports = { runAcademicRegulationTests };
