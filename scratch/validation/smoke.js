/** READ-ONLY runtime smoke test against a RUNNING backend. No writes. */
const BASE = process.env.BASE || 'http://localhost:5000';

(async () => {
  const j = async (method, path, token, body) => {
    const h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    let d; try { d = await r.json(); } catch { d = null; }
    return { s: r.status, d };
  };

  const health = await j('GET', '/api/health');
  console.log('health          ', health.s, JSON.stringify(health.d));

  const roles = { HOD: 'hod@nec.edu.in', AC: 'ac@nec.edu.in', FACULTY: 'faculty@nec.edu.in', ADMIN: 'admin@nec.edu.in' };
  const T = {};
  for (const [role, email] of Object.entries(roles)) {
    const r = await j('POST', '/api/auth/login', null, { email, password: 'Password123!' });
    T[role] = r.d && r.d.data && r.d.data.token;
    console.log(`login ${role.padEnd(8)}`.padEnd(22), r.s, r.d && r.d.data ? 'role=' + r.d.data.user.role : JSON.stringify(r.d).slice(0, 90));
  }

  const ctx = await j('GET', '/api/academic-contexts', T.AC);
  const ctxs = (ctx.d && ctx.d.data) || [];
  console.log('academic-contexts', ctx.s, 'count=' + ctxs.length);
  if (ctxs[0]) {
    const id = ctxs[0]._id;
    console.log('  sample:', ctxs[0].academicYear, ctxs[0].semester, 'Sec', ctxs[0].section, 'id=' + id.slice(-6));
    for (const [label, p] of [
      ['design-context', '/api/timetable/design-context/' + id],
      ['context-status ', '/api/timetable/context-status/' + id],
      ['versions(ctx) ', '/api/timetable/versions?academicContextId=' + id],
      ['published     ', '/api/timetable/published/' + id],
    ]) {
      const r = await j('GET', p, T.AC);
      console.log('  ' + label, r.s, r.d && r.d.success ? 'OK' : JSON.stringify(r.d).slice(0, 90));
    }
    const v = await j('GET', '/api/hod-allocations/validate/' + id, T.AC);
    console.log('  hod-validate  ', v.s, v.d && v.d.success ? 'OK' : JSON.stringify(v.d).slice(0, 90));
  }

  const gen = await j('POST', '/api/timetable/generate-from-context', T.FACULTY, { academicContextId: 'x' });
  console.log('RBAC faculty gen', gen.s, gen.d && gen.d.code);

  const sub = await j('GET', '/api/substitutes/eligible-faculty', T.AC);
  console.log('eligible-faculty', sub.s, sub.d && sub.d.code ? sub.d.code : 'OK');
})().catch((e) => { console.error('SMOKE FAILED:', e.message); process.exit(1); });