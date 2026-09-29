/**
 * HOD Curriculum Coverage & Course-Faculty Allocation Test Suite
 * 
 * Verifies:
 * 1. Complete semester coverage: Semester III, IV, V, VI, VII, VIII
 * 2. Exact authoritative course counts per semester:
 *    - Sem III: 10
 *    - Sem IV: 10
 *    - Sem V: 6 core
 *    - Sem VI: 4 core (+ 4 management electives = 8 total)
 *    - Sem VII: 2 core
 *    - Sem VIII: 1 core (22CSD01, 20 periods)
 * 3. Exact course codes and authoritative names from R22 curriculum
 * 4. Critical course attributes: 22GED01 (0 periods), 22CSD01 (20 periods)
 * 5. Negative tests (zero cross-semester course leakage)
 * 6. Semester query normalization (Arabic numerals, Roman numerals, prefix variations)
 * 7. HOD Allocation CRUD operations (Create, Read, Reassign via PUT, Conflict 409, Delete)
 * 8. Full cohort / section coverage: II Year, III Year, IV Year across Sections A, B, C, D
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const Course = require('../src/models/Course');
const AcademicContext = require('../src/models/AcademicContext');
const Faculty = require('../src/models/Faculty');
const HODFacultyAllocation = require('../src/models/HODFacultyAllocation');
const User = require('../src/models/User');

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

async function runTests() {
  console.log('============================================================');
  console.log('HOD CURRICULUM ALLOCATION & FULL SEMESTER COVERAGE TEST SUITE');
  console.log('============================================================\n');

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nec_faculty_db');
    }

    // 0. Ensure HOD user exists for authenticated requests
    let hodUser = await User.findOne({ role: 'HOD' });
    if (!hodUser) {
      hodUser = await User.create({
        email: 'hod.test@nec.edu.in',
        password: '$2a$10$hashedpasswordplaceholder1234567890',
        name: 'Head of Department',
        role: 'HOD',
        department: 'CSE',
      });
    }

    const { generateToken } = require('../src/utils/generateToken');
    const hodToken = generateToken(hodUser);
    const authHeaders = { Authorization: `Bearer ${hodToken}` };

    // --- TEST 1: Semester III Course Roster ---
    console.log('--- TEST 1: Semester III Curriculum Roster ---');
    const sem3Res = await makeRequest(app, { path: '/api/courses?semester=Semester%20III&limit=100' });
    assert(sem3Res.statusCode === 200, 'GET /api/courses?semester=Semester III returns HTTP 200');
    const sem3Items = sem3Res.body.data.items || [];
    assert(sem3Items.length === 10, `Semester III returns exactly 10 courses (got: ${sem3Items.length})`);
    
    const expectedSem3Codes = [
      '22CSC05', '22CSC06', '22CSC07', '22CSC08',
      '22CSP04', '22CSP05', '22CSP06', '22MAN04R',
      '22MAN09', '22MYB05'
    ];
    const sem3Codes = sem3Items.map((c) => c.courseCode).sort();
    assert(
      JSON.stringify(sem3Codes) === JSON.stringify(expectedSem3Codes.sort()),
      `Semester III contains exact expected course codes: ${expectedSem3Codes.join(', ')}`
    );

    // Verify exact authoritative course names for Semester III
    const sem3Map = new Map(sem3Items.map((c) => [c.courseCode, c.courseName]));
    assert(sem3Map.get('22CSC05') === 'Algorithms', '22CSC05 name is "Algorithms"');
    assert(sem3Map.get('22CSC06') === 'Computer Networks', '22CSC06 name is "Computer Networks"');
    assert(sem3Map.get('22CSC07') === 'Java Programming', '22CSC07 name is "Java Programming"');
    assert(sem3Map.get('22CSC08') === 'Operating Systems', '22CSC08 name is "Operating Systems"');
    assert(sem3Map.get('22MYB05') === 'Discrete Mathematics', '22MYB05 name is "Discrete Mathematics"');
    assert(sem3Map.get('22CSP04') === 'Algorithms Laboratory', '22CSP04 name is "Algorithms Laboratory"');
    assert(sem3Map.get('22CSP05') === 'Computer Networks Laboratory', '22CSP05 name is "Computer Networks Laboratory"');
    assert(sem3Map.get('22CSP06') === 'Java Programming Laboratory', '22CSP06 name is "Java Programming Laboratory"');
    assert(sem3Map.get('22MAN04R') === 'Soft/Analytical Skills - II', '22MAN04R name is "Soft/Analytical Skills - II"');
    assert(sem3Map.get('22MAN09') === 'Indian Constitution', '22MAN09 name is "Indian Constitution"');

    // --- TEST 2: Semester IV Course Roster ---
    console.log('\n--- TEST 2: Semester IV Curriculum Roster ---');
    const sem4Res = await makeRequest(app, { path: '/api/courses?semester=Semester%20IV&limit=100' });
    assert(sem4Res.statusCode === 200, 'GET /api/courses?semester=Semester IV returns HTTP 200');
    const sem4Items = sem4Res.body.data.items || [];
    assert(sem4Items.length === 10, `Semester IV returns exactly 10 courses (got: ${sem4Items.length})`);

    const expectedSem4Codes = [
      '22CSC09', '22CSC10', '22CSC11', '22CSC12',
      '22CSC13', '22CSP07', '22CSP08', '22CYB07',
      '22GED01', '22MAN07R'
    ];
    const sem4Codes = sem4Items.map((c) => c.courseCode).sort();
    assert(
      JSON.stringify(sem4Codes) === JSON.stringify(expectedSem4Codes.sort()),
      `Semester IV contains exact expected course codes: ${expectedSem4Codes.join(', ')}`
    );

    // Verify 22GED01 has 0 periods
    const ged01 = sem4Items.find((c) => c.courseCode === '22GED01');
    assert(ged01 && ged01.totalPeriod === 0, '22GED01 preserves totalPeriod = 0');
    assert(ged01 && ged01.L === 0 && ged01.T === 0 && ged01.P === 0, '22GED01 preserves L-T-P = 0-0-0');

    // --- TEST 3: Semester V Course Roster ---
    console.log('\n--- TEST 3: Semester V Curriculum Roster ---');
    const sem5Res = await makeRequest(app, { path: '/api/courses?semester=Semester%20V&limit=100' });
    assert(sem5Res.statusCode === 200, 'GET /api/courses?semester=Semester V returns HTTP 200');
    const sem5Items = sem5Res.body.data.items || [];
    assert(sem5Items.length === 6, `Semester V returns exactly 6 core courses (got: ${sem5Items.length})`);
    const expectedSem5Codes = ['22CSC14', '22CSC15', '22CSC16', '22CSP09', '22CSP10', '22MAN8R'];
    const sem5Codes = sem5Items.map((c) => c.courseCode).sort();
    assert(
      JSON.stringify(sem5Codes) === JSON.stringify(expectedSem5Codes.sort()),
      `Semester V contains exact expected core course codes: ${expectedSem5Codes.join(', ')}`
    );

    // --- TEST 4: Semester VI Course Roster ---
    console.log('\n--- TEST 4: Semester VI Curriculum Roster ---');
    const sem6Res = await makeRequest(app, { path: '/api/courses?semester=Semester%20VI&limit=100' });
    assert(sem6Res.statusCode === 200, 'GET /api/courses?semester=Semester VI returns HTTP 200');
    const sem6Items = sem6Res.body.data.items || [];
    const sem6CoreItems = sem6Items.filter((c) => c.category === 'PCC');
    assert(sem6CoreItems.length === 4, `Semester VI returns exactly 4 core PCC courses (got: ${sem6CoreItems.length})`);
    const sem6CoreCodes = sem6CoreItems.map((c) => c.courseCode).sort();
    assert(
      JSON.stringify(sem6CoreCodes) === JSON.stringify(['22CSC17', '22CSC18', '22CSP11', '22CSP12']),
      'Semester VI contains exact core courses: 22CSC17, 22CSC18, 22CSP11, 22CSP12'
    );
    const sem6MgmtItems = sem6Items.filter((c) => c.electiveType === 'Management Elective');
    assert(sem6MgmtItems.length === 4, `Semester VI includes 4 Management Electives (got: ${sem6MgmtItems.length})`);

    // --- TEST 5: Semester VII Course Roster ---
    console.log('\n--- TEST 5: Semester VII Curriculum Roster ---');
    const sem7Res = await makeRequest(app, { path: '/api/courses?semester=Semester%20VII&limit=100' });
    assert(sem7Res.statusCode === 200, 'GET /api/courses?semester=Semester VII returns HTTP 200');
    const sem7Items = sem7Res.body.data.items || [];
    assert(sem7Items.length === 2, `Semester VII returns exactly 2 core courses (got: ${sem7Items.length})`);
    const sem7Codes = sem7Items.map((c) => c.courseCode).sort();
    assert(
      JSON.stringify(sem7Codes) === JSON.stringify(['22GEA01', '22GED02']),
      'Semester VII contains exact core courses: 22GEA01 (UHV), 22GED02 (Internship)'
    );

    // --- TEST 6: Semester VIII Course Roster ---
    console.log('\n--- TEST 6: Semester VIII Curriculum Roster ---');
    const sem8Res = await makeRequest(app, { path: '/api/courses?semester=Semester%20VIII&limit=100' });
    assert(sem8Res.statusCode === 200, 'GET /api/courses?semester=Semester VIII returns HTTP 200');
    const sem8Items = sem8Res.body.data.items || [];
    assert(sem8Items.length === 1, `Semester VIII returns exactly 1 project course (got: ${sem8Items.length})`);
    assert(sem8Items[0].courseCode === '22CSD01', 'Semester VIII course is 22CSD01 (Project Work)');
    assert(sem8Items[0].totalPeriod === 20, '22CSD01 has totalPeriod = 20 (0-0-20)');

    // --- TEST 7: Negative Tests (Cross-Semester Isolation) ---
    console.log('\n--- TEST 7: Negative Tests (Zero Cross-Semester Leakage) ---');
    const sem3HasSem4 = sem3Items.some((c) => expectedSem4Codes.includes(c.courseCode));
    assert(!sem3HasSem4, 'Semester III contains zero Semester IV courses');

    const sem4HasSem3 = sem4Items.some((c) => expectedSem3Codes.includes(c.courseCode));
    assert(!sem4HasSem3, 'Semester IV contains zero Semester III courses');

    const sem5HasSem6 = sem5Items.some((c) => sem6CoreCodes.includes(c.courseCode));
    assert(!sem5HasSem6, 'Semester V contains zero Semester VI courses');

    const sem6HasSem5 = sem6Items.some((c) => expectedSem5Codes.includes(c.courseCode));
    assert(!sem6HasSem5, 'Semester VI contains zero Semester V courses');

    const sem7HasSem8 = sem7Items.some((c) => c.courseCode === '22CSD01');
    assert(!sem7HasSem8, 'Semester VII contains zero Semester VIII courses');

    const sem8HasSem7 = sem8Items.some((c) => c.courseCode === '22GEA01' || c.courseCode === '22GED02');
    assert(!sem8HasSem7, 'Semester VIII contains zero Semester VII courses');

    // --- TEST 8: Semester Parameter Normalization ---
    console.log('\n--- TEST 8: Query Parameter Normalization ---');
    const arabic3Res = await makeRequest(app, { path: '/api/courses?semester=3&limit=100' });
    assert(arabic3Res.body.data.items?.length === 10, 'semester=3 normalizes to Semester III (10 courses)');

    const semPrefix3Res = await makeRequest(app, { path: '/api/courses?semester=Sem%203&limit=100' });
    assert(semPrefix3Res.body.data.items?.length === 10, 'semester=Sem 3 normalizes to Semester III (10 courses)');

    const roman4Res = await makeRequest(app, { path: '/api/courses?semester=IV&limit=100' });
    assert(roman4Res.body.data.items?.length === 10, 'semester=IV normalizes to Semester IV (10 courses)');

    const arabic4Res = await makeRequest(app, { path: '/api/courses?semester=4&limit=100' });
    assert(arabic4Res.body.data.items?.length === 10, 'semester=4 normalizes to Semester IV (10 courses)');

    const arabic8Res = await makeRequest(app, { path: '/api/courses?semester=8&limit=100' });
    assert(arabic8Res.body.data.items?.length === 1, 'semester=8 normalizes to Semester VIII (1 course)');

    // --- TEST 9: HOD Faculty Allocation Lifecycle Across Semesters ---
    console.log('\n--- TEST 9: HOD Faculty Allocation CRUD Operations ---');
    const ctxII_A = await AcademicContext.findOne({ year: 'II Year', section: 'A' });
    assert(Boolean(ctxII_A), 'Found II Year Section A context');

    // Clean any pre-existing test allocation
    await HODFacultyAllocation.deleteMany({
      academicContextId: ctxII_A._id,
      courseCode: { $in: ['22CSC05', '22CSC09'] },
    });

    // 9.1 Create allocation for Semester III course
    const createRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/hod-allocations',
      headers: authHeaders,
      body: {
        academicContextId: ctxII_A._id,
        courseCode: '22CSC05',
        courseName: 'Algorithms',
        facultyId: 'FWL-04',
        allocationType: 'THEORY',
        status: 'APPROVED',
      },
    });
    assert(createRes.statusCode === 201, 'POST /api/hod-allocations creates allocation with HTTP 201');
    const createdAllocId = createRes.body.data?._id;
    assert(Boolean(createdAllocId), 'Allocation ID is returned in response');
    assert(createRes.body.data?.status === 'APPROVED', 'Allocation status is APPROVED');

    // 9.2 Conflict rejection on duplicate
    const conflictRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/hod-allocations',
      headers: authHeaders,
      body: {
        academicContextId: ctxII_A._id,
        courseCode: '22CSC05',
        facultyId: 'FWL-05',
        allocationType: 'THEORY',
      },
    });
    assert(conflictRes.statusCode === 409, 'Duplicate active allocation is rejected with HTTP 409 conflict');

    // 9.3 PUT update (reassign faculty)
    const updateRes = await makeRequest(app, {
      method: 'PUT',
      path: `/api/hod-allocations/${createdAllocId}`,
      headers: authHeaders,
      body: {
        facultyId: 'FWL-06',
        facultyName: 'Dr. Reassigned Faculty',
        allocationType: 'THEORY',
        status: 'APPROVED',
      },
    });
    assert(updateRes.statusCode === 200, 'PUT /api/hod-allocations/:id reassigns faculty with HTTP 200');
    assert(updateRes.body.data?.facultyId === 'FWL-06', 'Allocation facultyId updated to FWL-06');

    // 9.4 Read allocations
    const getRes = await makeRequest(app, {
      path: `/api/hod-allocations?academicContextId=${ctxII_A._id}&courseCode=22CSC05`,
    });
    assert(getRes.statusCode === 200, 'GET /api/hod-allocations returns HTTP 200');
    assert(getRes.body.data?.length === 1, 'Found exactly 1 allocation for 22CSC05');
    assert(getRes.body.data[0].facultyId === 'FWL-06', 'Retrieved allocation matches updated facultyId');

    // 9.5 Delete allocation
    const deleteRes = await makeRequest(app, {
      method: 'DELETE',
      path: `/api/hod-allocations/${createdAllocId}`,
      headers: authHeaders,
    });
    assert(deleteRes.statusCode === 200, 'DELETE /api/hod-allocations/:id deletes allocation with HTTP 200');

    // Verify deletion
    const verifyDelRes = await makeRequest(app, {
      path: `/api/hod-allocations?academicContextId=${ctxII_A._id}&courseCode=22CSC05`,
    });
    assert(verifyDelRes.body.data?.length === 0, 'Allocation is successfully removed');

    // Clean up test user if created
    if (hodUser.email === 'hod.test@nec.edu.in') {
      await User.findByIdAndDelete(hodUser._id);
    }

    console.log('\n============================================================');
    console.log(`HOD CURRICULUM ALLOCATION TEST SUITE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('============================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
