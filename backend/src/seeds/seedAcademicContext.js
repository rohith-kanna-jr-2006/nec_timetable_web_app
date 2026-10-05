const AcademicContext = require('../models/AcademicContext');

async function seedAcademicContext() {
  console.log('[Seed] Seeding academic contexts...');

  const contexts = [
    // II Year (Semester III)
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'II Year', section: 'A', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'II Year', section: 'B', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'II Year', section: 'C', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'II Year', section: 'D', program: 'UG', status: 'ACTIVE' },
    // III Year (Semester V)
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'III Year', section: 'A', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'III Year', section: 'B', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'III Year', section: 'C', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'III Year', section: 'D', program: 'UG', status: 'ACTIVE' },
    // IV Year (Semester VII)
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'IV Year', section: 'A', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'IV Year', section: 'B', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'IV Year', section: 'C', program: 'UG', status: 'ACTIVE' },
    { academicYearFrom: 2026, academicYearTo: 2027, academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'IV Year', section: 'D', program: 'UG', status: 'ACTIVE' },
  ];

  for (const ctx of contexts) {
    await AcademicContext.findOneAndUpdate(
      {
        academicYearFrom: ctx.academicYearFrom,
        academicYearTo: ctx.academicYearTo,
        semester: ctx.semester,
        department: ctx.department,
        year: ctx.year,
        section: ctx.section,
      },
      { $set: ctx },
      { upsert: true, new: true }
    );
  }

  const allActive = await AcademicContext.find({
    academicYearFrom: 2026,
    academicYearTo: 2027,
    semester: 'Odd Semester',
    department: 'CSE',
    status: 'ACTIVE',
  });
  console.log(`[Seed] Successfully seeded and verified ${allActive.length} target academic contexts.`);
  return allActive;
}

module.exports = { seedAcademicContext };
