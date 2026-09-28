const Faculty = require('../models/Faculty');
const path = require('path');

async function seedFaculty() {
  console.log('[Seed] Importing faculty from constants/workloadMasterData.js...');
  const workloadModule = await import('../data/workloadMasterData.js');
  const masterData = workloadModule.FACULTY_WORKLOAD_MASTER;

  const facultyDocs = masterData.map((f) => {
    // Determine roles from designation and responsibilities
    const roles = [];
    const desigLower = (f.designation || '').toLowerCase();
    if (desigLower.includes('hod')) roles.push('HOD');
    if ((f.responsibilities || []).some((r) => (r.role || '').toLowerCase().includes('academic coordinator'))) {
      roles.push('ACADEMIC_COORDINATOR');
    }
    if ((f.responsibilities || []).some((r) => (r.role || '').toLowerCase().includes('class advisor'))) {
      roles.push('CLASS_ADVISOR');
    }
    if ((f.responsibilities || []).some((r) => (r.role || '').toLowerCase().includes('proctor'))) {
      roles.push('PROCTOR');
    }

    // Generate safe email slug from name
    const cleanName = f.facultyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const email = `${cleanName}@nec.edu.in`;

    const isECE = f.facultyId === 'FWL-26' || f.facultyId === 'FWL-27' || (f.designation || '').includes('ECE');
    const department = isECE
      ? 'Department of Electronics and Communication Engineering'
      : 'Department of Computer Science and Engineering';

    return {
      facultyId: f.facultyId,
      facultyName: f.facultyName, // Exact spelling preserved (e.g. Dr. S. Karpusamy)
      designation: f.designation,
      department,
      email,
      phone: null,
      roles,
      isActive: true,
    };
  });

  await Faculty.deleteMany({});
  const inserted = await Faculty.insertMany(facultyDocs);
  console.log(`[Seed] Successfully seeded ${inserted.length} faculty members (25 CSE, 2 ECE).`);
  if (inserted.length !== 27) {
    throw new Error(`Expected exactly 27 faculty records, but seeded: ${inserted.length}`);
  }
  return inserted;
}

module.exports = { seedFaculty };
