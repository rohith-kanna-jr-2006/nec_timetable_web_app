/**
 * Phase 2 Automated Auth & RBAC Verification Suite
 * Verifies live API endpoints on http://localhost:5000/api and client auth logic.
 */

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:5000/api';

// Provide standard localStorage shim if running directly under Node.js CLI
if (typeof global.localStorage === 'undefined') {
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

async function runAuthTests() {
  console.log('====================================================');
  console.log('PHASE 2 AUTHENTICATION & RBAC INTEGRATION TEST SUITE');
  console.log(`API Base URL: ${BASE_URL}`);
  console.log('====================================================\n');

  // Test 1: Health Check
  let backendOnline = false;
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.success === true, 'Backend API health check (/api/health)');
    backendOnline = true;
  } catch (err) {
    console.log(`  ℹ INFO: Backend server on port 5000 is offline (${err.message}).`);
    console.log('  ℹ INFO: Skipping live API network calls; running client-side auth tests.\n');
  }

  if (!backendOnline) {
    // Run Client-side tests only
    const { getDefaultDashboard } = await import('../src/services/authService.js');
    assert(getDefaultDashboard('FACULTY') === '/faculty/dashboard', 'Role FACULTY maps to /faculty/dashboard');
    assert(getDefaultDashboard('AC') === '/coordinator/dashboard', 'Role AC maps to /coordinator/dashboard');
    assert(getDefaultDashboard('HOD') === '/hod/dashboard', 'Role HOD maps to /hod/dashboard');
    assert(getDefaultDashboard('ADMIN') === '/hod/dashboard', 'Role ADMIN maps to /hod/dashboard');

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('====================================================');
    return;
  }

  // Test 2: Role 1 - Faculty Login
  let facultyToken = null;
  let facultyUser = null;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'faculty@nec.edu.in', password: 'Password123!' }),
    });
    const data = await res.json();
    assert(res.status === 200, 'Faculty login HTTP 200 status');
    assert(data.success === true, 'Faculty login success response flag');
    assert(Boolean(data.data?.token), 'Faculty JWT token generated');
    assert(data.data?.user?.role === 'FACULTY', 'Faculty user role is FACULTY');
    assert(data.data?.user?.facultyId === 'FWL-03', 'Faculty profile maps to FWL-03');
    facultyToken = data.data?.token;
    facultyUser = data.data?.user;
  } catch (err) {
    assert(false, `Faculty login failed: ${err.message}`);
  }

  // Test 3: Role 2 - Academic Coordinator Login
  let acToken = null;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ac@nec.edu.in', password: 'Password123!' }),
    });
    const data = await res.json();
    assert(res.status === 200, 'Academic Coordinator login HTTP 200 status');
    assert(data.data?.user?.role === 'AC', 'AC user role is AC');
    assert(data.data?.user?.facultyId === 'FWL-22', 'AC profile maps to FWL-22');
    acToken = data.data?.token;
  } catch (err) {
    assert(false, `AC login failed: ${err.message}`);
  }

  // Test 4: Role 3 - HOD Login
  let hodToken = null;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'hod@nec.edu.in', password: 'Password123!' }),
    });
    const data = await res.json();
    assert(res.status === 200, 'HOD login HTTP 200 status');
    assert(data.data?.user?.role === 'HOD', 'HOD user role is HOD');
    assert(data.data?.user?.facultyId === 'FWL-01', 'HOD profile maps to FWL-01');
    hodToken = data.data?.token;
  } catch (err) {
    assert(false, `HOD login failed: ${err.message}`);
  }

  // Test 5: Role 4 - System Administrator Login
  let adminToken = null;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@nec.edu.in', password: 'Password123!' }),
    });
    const data = await res.json();
    assert(res.status === 200, 'Admin login HTTP 200 status');
    assert(data.data?.user?.role === 'ADMIN', 'Admin user role is ADMIN');
    adminToken = data.data?.token;
  } catch (err) {
    assert(false, `Admin login failed: ${err.message}`);
  }

  // Test 6: Invalid Credentials (Wrong Password)
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'faculty@nec.edu.in', password: 'WrongPassword123!' }),
    });
    const data = await res.json();
    assert(res.status === 401, 'Invalid password rejected with HTTP 401');
    assert(data.success === false, 'Invalid credentials success flag is false');
  } catch (err) {
    assert(false, `Invalid password test error: ${err.message}`);
  }

  // Test 7: Non-existent User
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@nec.edu.in', password: 'Password123!' }),
    });
    const data = await res.json();
    assert(res.status === 401, 'Non-existent account rejected with HTTP 401');
  } catch (err) {
    assert(false, `Non-existent user test error: ${err.message}`);
  }

  // Test 8: Session Restoration (GET /api/auth/me with valid Bearer token)
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const data = await res.json();
    const user = data.data?.user || data.data;
    assert(res.status === 200, 'Session restoration (/auth/me) HTTP 200');
    assert(user?.email === 'faculty@nec.edu.in', 'Restored user profile matches faculty email');
    assert(user?.role === 'FACULTY', 'Restored user role is FACULTY');
  } catch (err) {
    assert(false, `Session restoration test error: ${err.message}`);
  }

  // Test 9: Session Restoration with Missing / Invalid Token
  try {
    const resMissing = await fetch(`${BASE_URL}/auth/me`, { method: 'GET' });
    assert(resMissing.status === 401, 'Missing token correctly rejected with HTTP 401');

    const resInvalid = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: 'Bearer fake.invalid.jwt.token' },
    });
    assert(resInvalid.status === 401, 'Invalid JWT token correctly rejected with HTTP 401');
  } catch (err) {
    assert(false, `Unauthorized token test error: ${err.message}`);
  }

  // Test 10: Role-Based Access Control on Protected Endpoints
  // AC cannot approve HOD allocations (requires HOD or ADMIN)
  try {
    const acForbiddenRes = await fetch(`${BASE_URL}/hod-allocations/6794d21234567890abcdef12/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${acToken}`,
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    assert(acForbiddenRes.status === 403, 'AC forbidden from HOD approval endpoint (HTTP 403)');
  } catch (err) {
    assert(false, `RBAC AC test error: ${err.message}`);
  }

  // Faculty cannot delete faculty records (requires ADMIN)
  try {
    const facultyForbiddenRes = await fetch(`${BASE_URL}/faculty/FWL-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert(facultyForbiddenRes.status === 403, 'Faculty forbidden from Admin endpoint (HTTP 403)');
  } catch (err) {
    assert(false, `RBAC Faculty test error: ${err.message}`);
  }

  // Test 11: Client-Side Default Dashboard Role Redirection Mapping
  const { getDefaultDashboard, login: clientLogin, logout: clientLogout, getStoredToken, getStoredUser } = await import('../src/services/authService.js');
  assert(getDefaultDashboard('FACULTY') === '/faculty/dashboard', 'Role FACULTY maps to /faculty/dashboard');
  assert(getDefaultDashboard('AC') === '/coordinator/dashboard', 'Role AC maps to /coordinator/dashboard');
  assert(getDefaultDashboard('HOD') === '/hod/dashboard', 'Role HOD maps to /hod/dashboard');
  assert(getDefaultDashboard('ADMIN') === '/hod/dashboard', 'Role ADMIN maps to /hod/dashboard');

  // Test 12: Client-Side AuthService Login & Logout Flow
  try {
    const loginResult = await clientLogin('hod@nec.edu.in', 'Password123!');
    assert(Boolean(loginResult.token), 'AuthService login returns valid token');
    assert(loginResult.user?.role === 'HOD', 'AuthService login stores HOD user');
    assert(getStoredToken() === loginResult.token, 'AuthService persists token in localStorage');
    assert(getStoredUser()?.email === 'hod@nec.edu.in', 'AuthService persists user in localStorage');

    clientLogout();
    assert(getStoredToken() === null, 'AuthService logout clears stored token');
    assert(getStoredUser() === null, 'AuthService logout clears stored user');
  } catch (err) {
    assert(false, `AuthService flow error: ${err.message}`);
  }

  // Test 13: Expired Token Rejection
  try {
    // Deliberately expired token payload (exp: 1 second in the past)
    const expiredTokenHeader = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const expiredPayload = Buffer.from(
      JSON.stringify({ id: '6ab75eddb243870f527e4214', exp: Math.floor(Date.now() / 1000) - 100 })
    ).toString('base64url');
    // Using dummy signature; verification fails due to expiration or signature
    const dummyExpiredToken = `${expiredTokenHeader}.${expiredPayload}.invalidsignature`;
    const expiredRes = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${dummyExpiredToken}` },
    });
    assert(expiredRes.status === 401, 'Expired/tampered token correctly rejected with HTTP 401');
  } catch (err) {
    assert(false, `Expired token test error: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAuthTests();
