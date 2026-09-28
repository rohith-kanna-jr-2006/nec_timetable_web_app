const AcademicContext = require('../models/AcademicContext');

async function seedAcademicContext() {
  console.log('[Seed] Seeding academic contexts...');

  const contexts = [
    {
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'III Year',
      section: 'A',
      program: 'UG',
      status: 'ACTIVE',
    },
    {
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'III Year',
      section: 'B',
      program: 'UG',
      status: 'ACTIVE',
    },
    {
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'III Year',
      section: 'C',
      program: 'UG',
      status: 'ACTIVE',
    },
    {
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'II Year',
      section: 'A',
      program: 'UG',
      status: 'ACTIVE',
    },
    {
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'II Year',
      section: 'B',
      program: 'UG',
      status: 'ACTIVE',
    },
    {
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'II Year',
      section: 'C',
      program: 'UG',
      status: 'ACTIVE',
    },
  ];

  await AcademicContext.deleteMany({});
  const inserted = await AcademicContext.insertMany(contexts);
  console.log(`[Seed] Successfully seeded ${inserted.length} academic contexts.`);
  return inserted;
}

module.exports = { seedAcademicContext };
