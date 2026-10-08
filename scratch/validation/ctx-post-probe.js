/**
 * VERIFICATION ONLY against the ISOLATED test DB (27018), port 5001.
 * Creates one throwaway AcademicContext in the disposable DB to prove whether
 * POST /api/academic-contexts is functional. Does NOT touch nec_faculty_db.
 */
const BASE = 'http://localhost:5001';

(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hod@nec.edu.in', password: 'Password123!' }),
  }).then((r) => r.json());
  const token = login.data.token;
  console.log('login role =', login.data.user.role);

  const res = await fetch(BASE + '/api/academic-contexts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      academicYear: '2099-2100',
      academicYearFrom: 2099,
      academicYearTo: 2100,
      fromYear: '2099',
      toYear: '2100',
      regulation: 'R22',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'V Year',
      section: 'A',
      program: 'UG',
      status: 'ACTIVE',
    }),
  });
  const text = await res.text();
  console.log('POST /api/academic-contexts ->', res.status);
  console.log('BODY:', text.slice(0, 500));
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });