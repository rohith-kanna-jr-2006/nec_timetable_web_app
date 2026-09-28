const CourseFacultyHandler = require('../models/CourseFacultyHandler');

async function seedHandlers() {
  console.log('[Seed] Seeding initial Course Faculty Handlers (AC candidate pools)...');

  const handlers = [
    {
      courseCode: '22CSC14',
      candidateFacultyIds: ['FWL-04', 'FWL-07', 'FWL-14'],
      preferredFacultyId: 'FWL-04',
      remarks: 'Proposed for Principles of Compiler Design',
      submittedBy: 'Mr. R. Manikandan (AC)',
    },
    {
      courseCode: '22CSP09',
      candidateFacultyIds: ['FWL-01', 'FWL-03', 'FWL-06'],
      preferredFacultyId: 'FWL-03',
      remarks: 'Full Stack Development Lab candidates',
      submittedBy: 'Mr. R. Manikandan (AC)',
    },
    {
      courseCode: '22CSC06',
      candidateFacultyIds: ['FWL-02', 'FWL-05', 'FWL-18'],
      preferredFacultyId: 'FWL-02',
      remarks: 'Computer Networks candidates',
      submittedBy: 'Mr. R. Manikandan (AC)',
    },
  ];

  await CourseFacultyHandler.deleteMany({});
  const inserted = await CourseFacultyHandler.insertMany(handlers);
  console.log(`[Seed] Successfully seeded ${inserted.length} candidate handler sets.`);
  return inserted;
}

module.exports = { seedHandlers };
