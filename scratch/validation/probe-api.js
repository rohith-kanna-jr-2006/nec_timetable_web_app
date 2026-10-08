/**
 * READ-ONLY API contract probe. Performs login + GET requests only.
 * Does NOT generate, approve, publish, assign, or mutate any timetable data.
 */
const BASE = process.env.BASE || 'http://localhost:5000';
const PWD = 'Password123!';

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = text.slice(0, 400); }
  return { status: res.status, body: json };
}

(async () => {
  const out = {};
  const health = await call('GET', '/api/health');
  console.log('HEALTH', health.status, JSON.stringify(health.body));

  // Logins
  const tokens = {};
  for (const [role, email] of Object.entries({
    HOD: 'hod@nec.edu.in',
    AC: 'ac@nec.edu.in',
    FACULTY: 'faculty@nec.edu.in',
    ADMIN: 'admin@nec.edu.in',
  })) {
    const r = await call('POST', '/api/auth/login', { body: { email, password: PWD } });
    const d = (r.body && r.body.data) || {};
    tokens[role] = d.token;
    out[role] = { status: r.status, role: d.user && d.user.role, facultyId: d.user && d.user.facultyId };
    console.log(`LOGIN ${role.padEnd(8)} ${email.padEnd(22)} -> ${r.status} serverRole=${d.user && d.user.role}`);
  }

  const probes = [
    ['GET', '/api/academic-contexts', 'AC'],
    ['GET', '/api/timetable/versions', 'AC'],
    ['GET', '/api/timetable/versions', 'HOD'],
    ['GET', '/api/substitutes/eligible-faculty', 'AC'],
    ['GET', '/api/courses/curriculum/r22', 'AC'],
    ['GET', '/api/faculty', 'AC'],
    ['GET', '/api/timetable/generate-from-context', 'FACULTY'],
  ];

  for (const [method, path, role] of probes) {
    const r = await call(method, path, { token: tokens[role] });
    let summary;
    if (r.body && typeof r.body === 'object') {
      const keys = Object.keys(r.body);
      summary = `keys=${keys.join(',')} ` + (Array.isArray(r.body.data) ? `data.len=${r.body.data.length}` : r.body.data ? 'data=obj' : '');
    } else summary = String(r.body).slice(0, 160);
    console.log(`${method} ${path} [${role}] -> ${r.status} ${summary}`);
  }

  // RBAC negative probe: FACULTY must be 403 on generate
  const rbac = await call('POST', '/api/timetable/generate-from-context', { token: tokens.FACULTY, body: { academicContextId: 'x' } });
  console.log('RBAC faculty generate ->', rbac.status, JSON.stringify(rbac.body).slice(0, 200));

  console.log('\nTOKENS_OK', Object.entries(tokens).map(([k, v]) => `${k}=${v ? 'yes' : 'no'}`).join(' '));
})().catch((e) => { console.error('PROBE FAILED', e); process.exit(1); });