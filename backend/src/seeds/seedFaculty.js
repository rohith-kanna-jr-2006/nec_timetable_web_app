const Faculty = require('../models/Faculty');
const { MATHEMATICS_FACULTY_MASTER, ENGLISH_FACULTY_MASTER } = require('../data/shFacultyMasterData');

async function seedFaculty() {
  console.log('[Seed] Importing faculty from data/workloadMasterData.js and data/shFacultyMasterData.js...');
  const workloadModule = await import('../data/workloadMasterData.js');
  const masterData = workloadModule.FACULTY_WORKLOAD_MASTER;

  const cseEceDocs = masterData.map((f) => {
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
      facultyName: f.facultyName,
      designation: f.designation,
      department,
      email,
      phone: null,
      roles,
      isActive: true,
    };
  });

  const allFacultyDocs = [
    ...cseEceDocs,
    ...MATHEMATICS_FACULTY_MASTER,
    ...ENGLISH_FACULTY_MASTER,
  ];

  // Non-destructive, idempotent upsert
  const bulkOps = allFacultyDocs.map((doc) => ({
    updateOne: {
      filter: { facultyId: doc.facultyId },
      update: { $set: doc },
      upsert: true,
    },
  }));

  await Faculty.bulkWrite(bulkOps);
  console.log(
    `[Seed] Successfully seeded ${allFacultyDocs.length} faculty members (25 CSE, 2 ECE, 16 Mathematics, 9 English).`
  );

  return allFacultyDocs;
}

module.exports = { seedFaculty };

