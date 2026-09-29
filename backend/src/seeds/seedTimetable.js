const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');
const AcademicContext = require('../models/AcademicContext');
const Faculty = require('../models/Faculty');
const Course = require('../models/Course');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');

async function seedTimetable() {
  console.log('[Seed] Seeding published timetable version and faculty session grid...');

  // Locate academic context for III Year CSE Section A
  let context = await AcademicContext.findOne({
    department: 'CSE',
    year: 'III Year',
    section: 'A',
  });

  if (!context) {
    context = await AcademicContext.create({
      academicYear: '2026-27',
      semester: 'Odd Semester',
      department: 'CSE',
      year: 'III Year',
      section: 'A',
      program: 'UG',
      status: 'ACTIVE',
    });
  }

  // Clear existing seeded timetable sessions and versions
  await TimetableSession.deleteMany({});
  await TimetableVersion.deleteMany({});

  const version = await TimetableVersion.create({
    academicContextId: context._id,
    academicYear: '2026-27',
    semester: 'Odd Semester',
    department: 'CSE',
    year: 'III Year',
    section: 'A',
    version: 1,
    versionLabel: 'v1.0 (Official Semester Rollout)',
    status: 'PUBLISHED',
    generatedBy: 'Mr. R. Manikandan (AC)',
    submittedBy: 'Mr. R. Manikandan (AC)',
    approvedBy: 'Dr. T. Rajasekaran (HOD)',
    approvedAt: new Date(),
    publishedAt: new Date(),
    hardConflicts: 0,
    totalScheduledPeriods: 35,
  });

  // Authoritative Semester V Core + Approved Elective Courses:
  // 22CSC14: Principles of Compiler Design (4 periods)
  // 22CSC15: Full Stack Development (3 periods)
  // 22CSC16: Object Oriented Software Engineering (3 periods)
  // 22CSP09: Full Stack Development Laboratory (4 periods)
  // 22CSP10: Object Oriented Software Engineering Laboratory (4 periods)
  // 22MAN8R: Soft/Analytical Skills - IV (3 periods)
  // 22CSX42: UI and UX Design [PEC - Slot E1] (3 periods)
  // 22CSX21: Fundamentals of Cryptography and Network Security [PEC - Slot E2] (3 periods)
  // Total Curriculum Contact Periods = 27 periods
  // Institutional Non-Academic Support Periods = 8 periods (Library, Mentoring, Seminar, Sports, Self-Study)

  const sessions = [
    // =========================================================================
    // MONDAY (7 periods)
    // =========================================================================
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC16',
      courseName: 'Object Oriented Software Engineering',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'MON',
      period: 'P1',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC15',
      courseName: 'Full Stack Development',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'MON',
      period: 'P2',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSX42',
      courseName: 'UI and UX Design',
      facultyId: 'FWL-06',
      facultyName: 'Mrs. E. Padma',
      day: 'MON',
      period: 'P3',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC14',
      courseName: 'Principles of Compiler Design',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      day: 'MON',
      period: 'P4',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22MAN8R',
      courseName: 'Soft/Analytical Skills - IV',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      day: 'MON',
      period: 'P5',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSX21',
      courseName: 'Fundamentals of Cryptography and Network Security',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      day: 'MON',
      period: 'P6',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: 'LIBRARY',
      courseName: 'Library & Online Certification',
      facultyId: 'FWL-06',
      facultyName: 'Mrs. E. Padma',
      day: 'MON',
      period: 'P7',
      room: 'Digital Library',
      sessionType: 'OTHER',
      duration: 1,
    },

    // =========================================================================
    // TUESDAY (7 periods)
    // =========================================================================
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC14',
      courseName: 'Principles of Compiler Design',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      day: 'TUE',
      period: 'P1',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSX21',
      courseName: 'Fundamentals of Cryptography and Network Security',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      day: 'TUE',
      period: 'P2',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC15',
      courseName: 'Full Stack Development',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'TUE',
      period: 'P3',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSP10',
      courseName: 'Object Oriented Software Engineering Laboratory',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'TUE',
      period: 'P4',
      room: 'Systems Lab 2',
      sessionType: 'LAB',
      duration: 4,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSP10',
      courseName: 'Object Oriented Software Engineering Laboratory',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'TUE',
      period: 'P5',
      room: 'Systems Lab 2',
      sessionType: 'LAB',
      duration: 4,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSP10',
      courseName: 'Object Oriented Software Engineering Laboratory',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'TUE',
      period: 'P6',
      room: 'Systems Lab 2',
      sessionType: 'LAB',
      duration: 4,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSP10',
      courseName: 'Object Oriented Software Engineering Laboratory',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'TUE',
      period: 'P7',
      room: 'Systems Lab 2',
      sessionType: 'LAB',
      duration: 4,
    },

    // =========================================================================
    // WEDNESDAY (7 periods)
    // =========================================================================
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSX42',
      courseName: 'UI and UX Design',
      facultyId: 'FWL-06',
      facultyName: 'Mrs. E. Padma',
      day: 'WED',
      period: 'P1',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC16',
      courseName: 'Object Oriented Software Engineering',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'WED',
      period: 'P2',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSP09',
      courseName: 'Full Stack Development Laboratory',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'WED',
      period: 'P3',
      room: 'Web Tech Lab',
      sessionType: 'LAB',
      duration: 4,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSP09',
      courseName: 'Full Stack Development Laboratory',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'WED',
      period: 'P4',
      room: 'Web Tech Lab',
      sessionType: 'LAB',
      duration: 4,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSP09',
      courseName: 'Full Stack Development Laboratory',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'WED',
      period: 'P5',
      room: 'Web Tech Lab',
      sessionType: 'LAB',
      duration: 4,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSP09',
      courseName: 'Full Stack Development Laboratory',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'WED',
      period: 'P6',
      room: 'Web Tech Lab',
      sessionType: 'LAB',
      duration: 4,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: 'SEMINAR',
      courseName: 'Technical Seminar & Communication',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      day: 'WED',
      period: 'P7',
      room: 'Seminar Hall 2',
      sessionType: 'OTHER',
      duration: 1,
    },

    // =========================================================================
    // THURSDAY (7 periods)
    // =========================================================================
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22MAN8R',
      courseName: 'Soft/Analytical Skills - IV',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      day: 'THU',
      period: 'P1',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC14',
      courseName: 'Principles of Compiler Design',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      day: 'THU',
      period: 'P2',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC16',
      courseName: 'Object Oriented Software Engineering',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'THU',
      period: 'P3',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSX42',
      courseName: 'UI and UX Design',
      facultyId: 'FWL-06',
      facultyName: 'Mrs. E. Padma',
      day: 'THU',
      period: 'P4',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC15',
      courseName: 'Full Stack Development',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'THU',
      period: 'P5',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: 'STUDY',
      courseName: 'Self-Study & Placement Practice',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'THU',
      period: 'P6',
      room: 'LH-101',
      sessionType: 'OTHER',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: 'MENTORING',
      courseName: 'Mentor Proctoring & Interaction',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'THU',
      period: 'P7',
      room: 'LH-101',
      sessionType: 'OTHER',
      duration: 1,
    },

    // =========================================================================
    // FRIDAY (7 periods)
    // =========================================================================
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSC14',
      courseName: 'Principles of Compiler Design',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      day: 'FRI',
      period: 'P1',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22CSX21',
      courseName: 'Fundamentals of Cryptography and Network Security',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      day: 'FRI',
      period: 'P2',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: '22MAN8R',
      courseName: 'Soft/Analytical Skills - IV',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      day: 'FRI',
      period: 'P3',
      room: 'LH-101',
      sessionType: 'THEORY',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: 'STUDY',
      courseName: 'Self-Study & Practice',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      day: 'FRI',
      period: 'P4',
      room: 'LH-101',
      sessionType: 'OTHER',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: 'STUDY',
      courseName: 'Self-Study & Revision',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'FRI',
      period: 'P5',
      room: 'LH-101',
      sessionType: 'OTHER',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: 'STUDY',
      courseName: 'Placement Aptitude Practice',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      day: 'FRI',
      period: 'P6',
      room: 'LH-101',
      sessionType: 'OTHER',
      duration: 1,
    },
    {
      timetableVersionId: version._id,
      academicContextId: context._id,
      courseCode: 'SPORTS',
      courseName: 'Sports & Extracurriculars',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      day: 'FRI',
      period: 'P7',
      room: 'Sports Complex',
      sessionType: 'OTHER',
      duration: 1,
    },
  ];

  const inserted = await TimetableSession.insertMany(sessions);
  console.log(`[Seed] Successfully seeded ${inserted.length} canonical timetable sessions across Mon-Fri.`);

  // Seed authoritative HOD faculty allocations for all curriculum courses
  await HODFacultyAllocation.deleteMany({});
  const hodAllocsMap = new Map();

  // Authoritative allocations for III Year Section A (Semester V)
  const sem5Authoritative = [
    {
      code: '22CSC14',
      name: 'Principles of Compiler Design',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      type: 'THEORY',
    },
    {
      code: '22CSC15',
      name: 'Full Stack Development',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      type: 'THEORY',
    },
    {
      code: '22CSC16',
      name: 'Object Oriented Software Engineering',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      type: 'THEORY',
    },
    {
      code: '22CSP09',
      name: 'Full Stack Development Laboratory',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      type: 'LAB_PRIMARY',
    },
    {
      code: '22CSP10',
      name: 'Object Oriented Software Engineering Laboratory',
      facultyId: 'FWL-03',
      facultyName: 'Dr. S. Karpusamy',
      type: 'LAB_PRIMARY',
    },
    {
      code: '22MAN8R',
      name: 'Soft/Analytical Skills - IV',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      type: 'THEORY',
    },
    {
      code: '22CSX42',
      name: 'UI and UX Design',
      facultyId: 'FWL-06',
      facultyName: 'Mrs. E. Padma',
      type: 'THEORY',
    },
    {
      code: '22CSX21',
      name: 'Fundamentals of Cryptography and Network Security',
      facultyId: 'FWL-12',
      facultyName: 'Mrs. K. Eswari',
      type: 'THEORY',
    },
  ];

  sem5Authoritative.forEach((item) => {
    hodAllocsMap.set(`${context._id}_${item.code}`, {
      academicContextId: context._id,
      courseCode: item.code,
      courseName: item.name,
      facultyId: item.facultyId,
      facultyName: item.facultyName,
      allocationType: item.type,
      assignedBy: 'Dr. T. Rajasekaran (HOD)',
      status: 'APPROVED',
    });
  });

  // Authoritative allocations for II Year Section A (Semester III)
  const iiYearA = await AcademicContext.findOne({ year: 'II Year', section: 'A' });
  if (iiYearA) {
    hodAllocsMap.set(`${iiYearA._id}_22CSC06`, {
      academicContextId: iiYearA._id,
      courseCode: '22CSC06',
      courseName: 'Computer Networks',
      facultyId: 'FWL-02',
      facultyName: 'Dr. B. Paramasivan',
      allocationType: 'THEORY',
      assignedBy: 'Dr. T. Rajasekaran (HOD)',
      status: 'APPROVED',
    });
  }

  // Authoritative allocations for IV Year Section A (Semester VII)
  const ivYearA = await AcademicContext.findOne({ year: 'IV Year', section: 'A' });
  if (ivYearA) {
    hodAllocsMap.set(`${ivYearA._id}_22GEA01`, {
      academicContextId: ivYearA._id,
      courseCode: '22GEA01',
      courseName: 'Universal Human Values',
      facultyId: 'FWL-01',
      facultyName: 'Dr. M. Bhuvaneswari',
      allocationType: 'THEORY',
      assignedBy: 'Dr. T. Rajasekaran (HOD)',
      status: 'APPROVED',
    });
    hodAllocsMap.set(`${ivYearA._id}_22CSC21`, {
      academicContextId: ivYearA._id,
      courseCode: '22CSC21',
      courseName: 'Cryptography and Network Security',
      facultyId: 'FWL-01',
      facultyName: 'Dr. M. Bhuvaneswari',
      allocationType: 'THEORY',
      assignedBy: 'Dr. T. Rajasekaran (HOD)',
      status: 'APPROVED',
    });
  }

  const insertedAllocs = await HODFacultyAllocation.insertMany(Array.from(hodAllocsMap.values()));
  console.log(`[Seed] Successfully seeded ${insertedAllocs.length} authoritative HOD faculty allocations.`);

  return { version, sessions: inserted, hodAllocations: insertedAllocs };
}

module.exports = { seedTimetable };
