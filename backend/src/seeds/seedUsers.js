const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function seedUsers() {
  console.log('[Seed] Seeding development user accounts with hashed passwords...');

  const defaultPassword = process.env.DEV_SEED_PASSWORD || 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  // Authoritative master faculty list
  const workloadModule = await import('../data/workloadMasterData.js');
  const masterData = workloadModule.FACULTY_WORKLOAD_MASTER;

  // Base alias accounts for test suites
  const users = [
    {
      name: 'Dr. T. Rajasekaran',
      email: 'hod@nec.edu.in',
      passwordHash,
      role: 'HOD',
      facultyId: 'FWL-01',
      isActive: true,
    },
    {
      // Legacy AC account — kept for backward-compatibility during migration.
      // After all client sessions using AC tokens expire, this account can be
      // updated to role: 'TC'. Do NOT delete it — it maps to facultyId FWL-22.
      name: 'Mr. R. Manikandan',
      email: 'ac@nec.edu.in',
      passwordHash,
      role: 'AC',
      facultyId: 'FWL-22',
      isActive: true,
    },
    {
      // TC account — canonical TimeTable Coordinator login (same faculty, new role).
      name: 'Mr. R. Manikandan',
      email: 'tc@nec.edu.in',
      passwordHash,
      role: 'TC',
      facultyId: 'FWL-22',
      isActive: true,
    },
    {
      name: 'Dr. S. Karpusamy',
      email: 'faculty@nec.edu.in',
      passwordHash,
      role: 'FACULTY',
      facultyId: 'FWL-03',
      isActive: true,
    },
    {
      name: 'System Administrator',
      email: 'admin@nec.edu.in',
      passwordHash,
      role: 'ADMIN',
      facultyId: null,
      isActive: true,
    },
  ];

  const existingEmails = new Set(users.map((u) => u.email.toLowerCase()));

  // Add all 27 faculty members as individual logins
  for (const f of masterData) {
    const cleanName = f.facultyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const email = `${cleanName}@nec.edu.in`;

    if (!existingEmails.has(email)) {
      const desigLower = (f.designation || '').toLowerCase();
      let role = 'FACULTY';
      if (desigLower.includes('hod')) role = 'HOD';
      // Faculty with an 'academic coordinator' or 'timetable coordinator' responsibility
      // are the TimeTable Coordinator (TC) — they hold timetable-design authority.
      else if ((f.responsibilities || []).some((r) =>
        (r.role || '').toLowerCase().includes('academic coordinator') ||
        (r.role || '').toLowerCase().includes('timetable coordinator')
      )) {
        role = 'TC';
      }

      users.push({
        name: f.facultyName,
        email,
        passwordHash,
        role,
        facultyId: f.facultyId,
        isActive: true,
      });
      existingEmails.add(email);
    }
  }

  await User.deleteMany({});
  const inserted = await User.insertMany(users);
  console.log(`[Seed] Successfully seeded ${inserted.length} development user accounts.`);
  return inserted;
}

module.exports = { seedUsers };
