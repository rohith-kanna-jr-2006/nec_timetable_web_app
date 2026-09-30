const Course = require('../models/Course');
const FacultyWorkload = require('../models/FacultyWorkload');
const TimetableSession = require('../models/TimetableSession');
const { R22_CSE_CURRICULUM_COURSES } = require('../data/r22CurriculumMaster');

/**
 * Normalizes course references across dependent collections
 */
async function migrateDependentReferences() {
  console.log('[Seed/Migration] Migrating dependent course references in FacultyWorkload & TimetableSession...');

  // 1. Migrate FacultyWorkload teaching arrays
  const workloads = await FacultyWorkload.find({});
  for (const wl of workloads) {
    let modified = false;

    for (const group of ['ugTheory1', 'ugTheory2', 'lab1', 'lab2', 'pg', 'others']) {
      if (Array.isArray(wl.teaching?.[group])) {
        for (const item of wl.teaching[group]) {
          if (!item.courseCode) continue;

          // Remap bogus 26CSC01 -> 22CSC01
          if (item.courseCode === '26CSC01') {
            item.courseCode = '22CSC01';
            item.courseName = 'Problem Solving and C Programming';
            modified = true;
          }
          // Remap bogus 26CSP01 -> 22CSP01
          else if (item.courseCode === '26CSP01') {
            item.courseCode = '22CSP01';
            item.courseName = 'Problem Solving and C Programming Laboratory';
            modified = true;
          }
          // Normalize (PSE) and (PBL) strings
          else if (item.courseCode === '22CSX01' && item.courseName.includes('(PSE')) {
            item.courseName = 'Deep Learning';
            modified = true;
          } else if (item.courseCode === '22CSX42' && item.courseName.includes('(PSE')) {
            item.courseName = 'UI and UX Design';
            modified = true;
          } else if (item.courseCode === '22CSX21' && item.courseName.includes('(PSE')) {
            item.courseName = 'Fundamentals of Cryptography and Network Security';
            modified = true;
          } else if (item.courseCode === '22CSC15' && item.courseName.includes('(PBL')) {
            item.courseName = 'Full Stack Development';
            modified = true;
          }
        }
      }
    }

    if (modified) {
      wl.markModified('teaching');
      await wl.save();
    }
  }

  // 2. Migrate TimetableSession titles
  await TimetableSession.updateMany(
    { courseCode: '22CSX42' },
    { $set: { courseName: 'UI and UX Design' } }
  );
  await TimetableSession.updateMany(
    { courseCode: '22CSX21' },
    { $set: { courseName: 'Fundamentals of Cryptography and Network Security' } }
  );
  await TimetableSession.updateMany(
    { courseCode: '22CSC15' },
    { $set: { courseName: 'Full Stack Development' } }
  );

  // 3. Migrate HODFacultyAllocation titles
  const HODFacultyAllocation = require('../models/HODFacultyAllocation');
  await HODFacultyAllocation.updateMany(
    { courseCode: '22CSX42' },
    { $set: { courseName: 'UI and UX Design' } }
  );
  await HODFacultyAllocation.updateMany(
    { courseCode: '22CSX21' },
    { $set: { courseName: 'Fundamentals of Cryptography and Network Security' } }
  );
  await HODFacultyAllocation.updateMany(
    { courseCode: '22CSC15' },
    { $set: { courseName: 'Full Stack Development' } }
  );
}

/**
 * Extracts and prepares PG courses needed for faculty workload integrity
 */
async function extractPGWorkloadCourses() {
  const workloadModule = await import('../data/workloadMasterData.js');
  const masterData = workloadModule.FACULTY_WORKLOAD_MASTER;

  const pgMap = new Map();

  masterData.forEach((f) => {
    Object.entries(f.teaching).forEach(([catKey, items]) => {
      items.forEach((item) => {
        if (!item.courseCode) return;
        const isPG = catKey === 'pg' || item.allocation?.includes('PG');
        if (isPG && !pgMap.has(item.courseCode)) {
          const isLab =
            catKey.toLowerCase().includes('lab') ||
            item.courseName.toLowerCase().includes('laboratory') ||
            item.courseName.toLowerCase().includes('lab');

          pgMap.set(item.courseCode, {
            courseCode: item.courseCode.toUpperCase().trim(),
            courseName: item.courseName.trim(),
            courseType: isLab ? 'LAB' : 'THEORY',
            category: 'Postgraduate Core',
            credits: isLab ? 2 : 3,
            regulation: 'R22-PG',
            programme: 'M.E. Computer Science and Engineering',
            academicYear: '2024-25 onwards',
            curriculumYear: '2024-25 onwards',
            semester: item.allocation?.includes('II Year') ? 'PG Semester III' : 'PG Semester I',
            department: 'CSE',
            isLab,
            isR22UG: false,
            isActive: true,
          });
        }
      });
    });
  });

  return Array.from(pgMap.values());
}

/**
 * Idempotently seeds the R22 CSE curriculum and preserved PG courses
 */
async function seedCourses() {
  console.log('[Seed] Seeding authoritative R22 CSE Curriculum (2024-25 Onwards)...');

  // 1. Migrate dependent references
  await migrateDependentReferences();

  // 2. Prepare R22 UG courses and PG courses
  const pgCourses = await extractPGWorkloadCourses();

  console.log(`[Seed] Upserting ${R22_CSE_CURRICULUM_COURSES.length} official R22 CSE UG courses...`);
  const bulkOps = R22_CSE_CURRICULUM_COURSES.map((course) => ({
    updateOne: {
      filter: { courseCode: course.courseCode },
      update: { $set: course },
      upsert: true,
    },
  }));

  await Course.bulkWrite(bulkOps);

  console.log(`[Seed] Upserting ${pgCourses.length} preserved PG workload courses...`);
  const pgBulkOps = pgCourses.map((pgCourse) => ({
    updateOne: {
      filter: { courseCode: pgCourse.courseCode },
      update: { $set: pgCourse },
      upsert: true,
    },
  }));

  await Course.bulkWrite(pgBulkOps);

  // 3. Remove obsolete mock course records (e.g. 26CSC01, 26CSP01) that have been cleanly remapped
  const obsoleteCodes = ['26CSC01', '26CSP01'];
  const removedResult = await Course.deleteMany({ courseCode: { $in: obsoleteCodes } });
  if (removedResult.deletedCount > 0) {
    console.log(`[Seed] Removed ${removedResult.deletedCount} obsolete mock course record(s): ${obsoleteCodes.join(', ')}`);
  }

  const totalCourses = await Course.countDocuments({ isActive: true });
  const r22UgCount = await Course.countDocuments({ isR22UG: true, isActive: true });
  const pgCount = await Course.countDocuments({ isR22UG: false, isActive: true });

  console.log(`[Seed] Successfully seeded and verified courses:`);
  console.log(`  - Total Active Courses: ${totalCourses}`);
  console.log(`  - Official R22 CSE UG Curriculum Courses: ${r22UgCount} (Expected: 109)`);
  console.log(`  - Preserved PG Workload Courses: ${pgCount} (Expected: 10)`);

  return { totalCourses, r22UgCount, pgCount };
}

module.exports = { seedCourses };

