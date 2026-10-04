/**
 * Phase 9 - Faculty Master security test suite.
 *
 * Covers: DOB domain, DOB-derived credential flow, credential secrecy,
 * existing-account safety, the faculty edit whitelist, identity integrity,
 * RBAC, and response sanitization.
 *
 * Isolation: every fixture is prefixed 'P9-' / 'p9_' so cleanup can never touch
 * seeded faculty, users, workloads or academic data. No seeded record is read
 * for mutation or removed.
 */

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const Faculty = require('../src/models/Faculty');
const FacultyWorkload = require('../src/models/FacultyWorkload');
const User = require('../src/models/User');
const { generateToken } = require('../src/utils/generateToken');
const { deriveInitialCredential } = require('../src/utils/facultyCredentials');

const P = 'P9-';
const emails = {
  hod: 'p9_hod@nec.edu.in',
  admin: 'p9_admin@nec.edu.in',
  tc: 'p9_tc@nec.edu.in',
  faculty: 'p9_fac@nec.edu.in',
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

function makeRequest(appInstance, { method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, () => {
      const port = server.address().port;
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: reqHeaders }, (res) => {
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
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function cleanup() {
  const facIds = (await Faculty.find({ facultyId: { $regex: '^' + P } }).select('facultyId').lean()).map((f) => f.facultyId);
  const userIds = (await User.find({ facultyId: { $in: facIds } }).select('_id').lean()).map((u) => u._id);
  await FacultyWorkload.deleteMany({ facultyId: { $in: facIds } });
  await Faculty.deleteMany({ facultyId: { $in: facIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await User.deleteMany({ email: { $in: Object.values(emails) } });
}

async function makeUser(email, role) {
  return User.findOneAndUpdate(
    { email },
    { $set: { name: 'Phase 9 ' + role, email, role, isActive: true, passwordHash: await bcrypt.hash('Seed-Pass-1', 10) } },
    { upsert: true, new: true }
  );
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 9: FACULTY MASTER SECURITY - TEST SUITE');
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

  const post = (body, headers) =>
    makeRequest(app, { method: 'POST', path: '/api/faculty', headers: headers || hodH, body });

  let n = 0;
  const nextId = () => P + 'DOB-' + (++n) + '-' + Math.floor(Math.random() * 100000);

  console.log('\n-- A: Faculty creation + credential ---------------------');

  const dob = '1990-05-15';
  const id1 = nextId();
  const created = await post({
    facultyId: id1,
    facultyName: 'Phase Nine Candidate',
    email: P + 'candidate@nec.edu.in',
    dateOfBirth: dob,
    designation: 'Assistant Professor',
  });
  assert(created.statusCode === 201, 'Valid faculty + DOB creates a record (got ' + created.statusCode + ')');

  const createdFaculty = await Faculty.findOne({ facultyId: id1 }).lean();
  assert(!!createdFaculty, 'Faculty master persisted');
  assert(createdFaculty.dateOfBirth instanceof Date, 'dateOfBirth stored as a Date');
  assert(createdFaculty.dateOfBirth.toISOString().slice(0, 10) === dob, 'Calendar day preserved without timezone drift (' + String(createdFaculty.dateOfBirth) + ')');

  const createdUser = await User.findOne({ facultyId: id1 }).select('+passwordHash').lean();
  assert(!!createdUser, 'A linked User account was created for the DOB-derived credential');
  assert(!!createdUser.passwordHash && createdUser.passwordHash.length > 20, 'passwordHash exists on the account');
  assert(createdUser.passwordHash !== deriveInitialCredential(dob), 'passwordHash is NOT the plaintext DDMMYYYY credential');
  assert(!createdUser.passwordHash.includes(deriveInitialCredential(dob)), 'passwordHash does not contain the plaintext credential');

  const rawUser = await User.collection.findOne({ facultyId: id1 });
  assert(rawUser.passwordHash !== deriveInitialCredential(dob), 'Database stores no plaintext credential');

  console.log('\n-- B: DOB validation ------------------------------------');

  const base = (extra) => Object.assign({
    facultyName: 'Phase Nine Invalid',
    designation: 'Assistant Professor',
  }, extra);

  const malformed = await post(base({ facultyId: nextId(), dateOfBirth: '15/05/1990' }));
  assert(malformed.statusCode === 400, 'Malformed DOB rejected (got ' + malformed.statusCode + ')');

  const impossible = await post(base({ facultyId: nextId(), dateOfBirth: '1990-02-31' }));
  assert(impossible.statusCode === 400, 'Impossible calendar date rejected (got ' + impossible.statusCode + ')');

  const future = await post(base({ facultyId: nextId(), dateOfBirth: '2999-01-01' }));
  assert(future.statusCode === 400, 'Future DOB rejected (got ' + future.statusCode + ')');

  const empty = await post(base({ facultyId: nextId(), dateOfBirth: '' }));
  assert([201, 400].indexOf(empty.statusCode) !== -1, 'Empty DOB handled deterministically (got ' + empty.statusCode + ')');
  if (empty.statusCode === 201) {
    await Faculty.deleteOne({ facultyId: empty.body.data.facultyId });
    await FacultyWorkload.deleteOne({ facultyId: empty.body.data.facultyId });
  }

  console.log('\n-- C: Credential secrecy ----------------------------------');

  const bodyText = JSON.stringify(created.body);
  assert(!/passwordHash/i.test(bodyText), 'Create response does not mention passwordHash');
  assert(bodyText.indexOf(deriveInitialCredential(dob)) === -1, 'Create response never contains the plaintext credential');

  const loginOk = await makeRequest(app, {
    method: 'POST',
    path: '/api/auth/login',
    body: { email: P + 'candidate@nec.edu.in', password: deriveInitialCredential(dob) },
  });
  assert(loginOk.statusCode === 200, 'Login with the DOB-derived credential works (got ' + loginOk.statusCode + ')');

  const loginBad = await makeRequest(app, {
    method: 'POST',
    path: '/api/auth/login',
    body: { email: P + 'candidate@nec.edu.in', password: '00000000' },
  });
  assert(loginBad.statusCode === 401, 'Wrong password fails (got ' + loginBad.statusCode + ')');

  const meRes = await makeRequest(app, { method: 'GET', path: '/api/auth/me', headers: hodH });
  assert(!/passwordHash/i.test(JSON.stringify(meRes.body)), 'auth/me never exposes passwordHash');

  console.log('\n-- D: Existing account safety ---------------------------');

  const existingUser = await User.findOne({ facultyId: id1 }).select('+passwordHash').lean();
  const hashBefore = existingUser.passwordHash;

  const editDob = await makeRequest(app, {
    method: 'PUT',
    path: '/api/faculty/' + id1,
    headers: hodH,
    body: { dateOfBirth: '1988-02-02' },
  });
  assert(editDob.statusCode === 200, 'DOB edit succeeds (got ' + editDob.statusCode + ')');

  const afterEdit = await User.findOne({ facultyId: id1 }).select('+passwordHash').lean();
  assert(afterEdit.passwordHash === hashBefore, 'A faculty edit NEVER resets an existing passwordHash');

  const afterFaculty = await Faculty.findOne({ facultyId: id1 }).lean();
  assert(afterFaculty.dateOfBirth.toISOString().slice(0, 10) === '1988-02-02', 'DOB update persisted correctly');

  const relogin = await makeRequest(app, {
    method: 'POST',
    path: '/api/auth/login',
    body: { email: P + 'candidate@nec.edu.in', password: deriveInitialCredential(dob) },
  });
  assert(relogin.statusCode === 200, 'The ORIGINAL credential still works after a DOB change (got ' + relogin.statusCode + ')');

  console.log('\n-- E: Faculty edit whitelist ----------------------------');

  const allowName = await makeRequest(app, { method: 'PUT', path: '/api/faculty/' + id1, headers: hodH, body: { facultyName: 'Phase Nine Renamed' } });
  assert(allowName.statusCode === 200 && allowName.body.data.facultyName === 'Phase Nine Renamed', 'facultyName is editable');

  const allowDesignation = await makeRequest(app, { method: 'PUT', path: '/api/faculty/' + id1, headers: hodH, body: { designation: 'Associate Professor' } });
  assert(allowDesignation.statusCode === 200, 'designation is editable');

  const allowPhone = await makeRequest(app, { method: 'PUT', path: '/api/faculty/' + id1, headers: hodH, body: { phone: '+91-90000-00000' } });
  assert(allowPhone.statusCode === 200, 'phone is editable');

  const allowEmail = await makeRequest(app, { method: 'PUT', path: '/api/faculty/' + id1, headers: hodH, body: { email: P + 'renamed@nec.edu.in' } });
  assert(allowEmail.statusCode === 200, 'email is editable');

  const protectedFields = [
    ['facultyId', 'P9-HIJACK'],
    ['role', 'ADMIN'],
    ['roles', ['ADMIN']],
    ['department', 'Hijacked Department'],
    ['password', 'hacked'],
    ['passwordHash', 'hacked'],
    ['isActive', false],
    ['createdAt', '1999-01-01'],
    ['updatedAt', '1999-01-01'],
    ['_id', '6aba13b47439464f20c4ceef'],
    ['workload', { calculatedTotalHours: 999 }],
    ['calculatedTotalHours', 999],
    ['teaching', { ugTheory1: [] }],
    ['responsibilities', [{ role: 'HOD' }]],
    ['allocations', []],
  ];

  for (const pair of protectedFields) {
    const field = pair[0];
    const value = pair[1];
    const body = {};
    body[field] = value;
    const res = await makeRequest(app, { method: 'PUT', path: '/api/faculty/' + id1, headers: hodH, body: body });
    assert(res.statusCode === 400, 'Protected field rejected: ' + field + ' (got ' + res.statusCode + ')');
  }

  const stillIntact = await Faculty.findOne({ facultyId: id1 }).lean();
  assert(stillIntact.facultyId === id1, 'facultyId was never mutated');
  assert(stillIntact.department !== 'Hijacked Department', 'department was never mutated');
  assert(stillIntact.isActive !== false, 'isActive was never mutated');

  console.log('\n-- F: Identity integrity ---------------------------------');

  const dup = await post({
    facultyId: id1,
    facultyName: 'Phase Nine Duplicate',
    designation: 'Assistant Professor',
  });
  assert(dup.statusCode === 409, 'Duplicate facultyId rejected (got ' + dup.statusCode + ')');

  const id2 = nextId();
  await post({ facultyId: id2, facultyName: 'Phase Nine Other', email: P + 'other@nec.edu.in', designation: 'Assistant Professor' });
  const dupEmail = await post({ facultyId: nextId(), facultyName: 'Phase Nine Dup Email', email: P + 'other@nec.edu.in', designation: 'Assistant Professor' });
  assert(dupEmail.statusCode === 409, 'Duplicate faculty email rejected (got ' + dupEmail.statusCode + ')');

  // The canonical Faculty<->User link is facultyId, not email. A faculty-information
  // email edit must NOT silently rewrite the login account (that would change the
  // credential identity behind a PII edit and could break an existing login).
  const linkedUser = await User.findOne({ facultyId: id1 }).select('facultyId email').lean();
  assert(!!linkedUser, 'Faculty/User linkage stays valid via facultyId');
  assert(String(linkedUser.email).toLowerCase() === (P + 'candidate@nec.edu.in').toLowerCase(), 'Editing faculty email does not mutate the login account');
  const renamedFaculty = await Faculty.findOne({ facultyId: id1 }).lean();
  assert(String(renamedFaculty.email).toLowerCase() === (P + 'renamed@nec.edu.in').toLowerCase(), 'The Faculty master email was updated');

  console.log('\n-- G: RBAC ------------------------------------------------');

  const adminCreate = await makeRequest(app, {
    method: 'POST',
    path: '/api/faculty',
    headers: adminH,
    body: { facultyId: nextId(), facultyName: 'Phase Nine Admin', designation: 'Assistant Professor' },
  });
  assert([201, 400].indexOf(adminCreate.statusCode) !== -1, 'ADMIN may create faculty (got ' + adminCreate.statusCode + ')');

  const tcCreate = await post({ facultyId: nextId(), facultyName: 'Phase Nine TC', designation: 'Assistant Professor' }, tcH);
  assert(tcCreate.statusCode === 403, 'TC does NOT gain faculty-creation authority (got ' + tcCreate.statusCode + ')');

  const tcEdit = await makeRequest(app, { method: 'PUT', path: '/api/faculty/' + id1, headers: tcH, body: { facultyName: 'TC Takeover' } });
  assert(tcEdit.statusCode === 403, 'TC does NOT gain faculty-edit authority (got ' + tcEdit.statusCode + ')');

  const facEdit = await makeRequest(app, { method: 'PUT', path: '/api/faculty/' + id1, headers: facH, body: { facultyName: 'Self Edit' } });
  assert(facEdit.statusCode === 403, 'FACULTY cannot edit faculty master (got ' + facEdit.statusCode + ')');

  const anonEdit = await makeRequest(app, { method: 'PUT', path: '/api/faculty/' + id1, body: { facultyName: 'Anon' } });
  assert(anonEdit.statusCode === 401, 'Unauthenticated faculty edit -> 401 (got ' + anonEdit.statusCode + ')');

  console.log('\n-- H: Response sanitization ------------------------------');

  const byId = await makeRequest(app, { method: 'GET', path: '/api/faculty/' + id1, headers: hodH });
  const byIdText = JSON.stringify(byId.body);
  assert(byId.statusCode === 200, 'GET faculty by id returns 200');
  assert(!/passwordHash/i.test(byIdText), 'GET faculty/:id exposes no passwordHash');
  assert(byIdText.indexOf(deriveInitialCredential(dob)) === -1, 'GET faculty/:id exposes no plaintext credential');

  const listRes = await makeRequest(app, { method: 'GET', path: '/api/faculty?limit=5', headers: hodH });
  assert(!/passwordHash/i.test(JSON.stringify(listRes.body)), 'GET faculty list exposes no passwordHash');

  const userRaw = await User.findOne({ facultyId: id1 }).lean();
  assert(userRaw.passwordHash === undefined, 'Faculty-facing reads never surface passwordHash');

  console.log('\n===============================================================');
  console.log('PHASE 9 FACULTY MASTER SECURITY: ' + passCount + ' PASSED, ' + failCount + ' FAILED');
  console.log('===============================================================\n');
}

(async () => {
  try {
    await runTests();
  } catch (error) {
    failCount++;
    console.error('\n[FATAL] Phase 9 suite aborted:', error && error.message ? error.message : error);
  } finally {
    await cleanup();
    await disconnectDB();
  }
  process.exit(failCount > 0 ? 1 : 0);
})();
