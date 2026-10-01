const { MATHEMATICS_FACULTY_MASTER, ENGLISH_FACULTY_MASTER } = require('./shFacultyMasterData');
const { R22_CSE_CURRICULUM_COURSES, R22_ELECTIVE_SLOT_MAP, R22_PEC_VERTICALS } = require('./r22CurriculumMaster');
const { calculateTeachingHours, calculateResponsibilityHours, parseYearAndSection } = require('../services/workloadService');

// Base 27 CSE/ECE faculty from workload master
const RAW_CSE_ECE = [
  { facultyId: 'FWL-01', facultyName: 'Dr. T. Rajasekaran', designation: 'Professor & Head Of Department HOD', department: 'Department of Computer Science and Engineering', email: 'hod@nec.edu.in', roles: ['HOD'], isActive: true },
  { facultyId: 'FWL-02', facultyName: 'Dr. B. V. Santhosh Krishna', designation: 'Associate Professor', department: 'Department of Computer Science and Engineering', email: 'santhoshkrishnabv@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-03', facultyName: 'Dr. S. Karpusamy', designation: 'Associate Professor', department: 'Department of Computer Science and Engineering', email: 'faculty@nec.edu.in', roles: ['FACULTY'], isActive: true },
  { facultyId: 'FWL-04', facultyName: 'Dr. A. Manchula', designation: 'Associate Professor', department: 'Department of Computer Science and Engineering', email: 'manchulaa@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-05', facultyName: 'Dr. C. Balakrishnan', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'balakrishnanc@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-06', facultyName: 'Mrs. E. Padma', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'padmae@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-07', facultyName: 'Mr. N. C. Karthikeyan', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'karthikeyannc@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-08', facultyName: 'Mrs. G. Kavitha', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'kavithag@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-09', facultyName: 'Mrs. B. Malathi', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'malathib@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-10', facultyName: 'Mr. K. S. Mohana Sundaram', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'mohanasundaramks@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-11', facultyName: 'Mrs. S. Soundariya', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'soundariyas@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-12', facultyName: 'Mrs. K. Eswari', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'eswarik@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-13', facultyName: 'Mrs. P. V. Ramya', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'ramyapv@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'vinoparkavid@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-15', facultyName: 'Mrs. S. G. Sandhiya', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'sandhiyasg@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-16', facultyName: 'Ms. S. Shanmugapriya', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'shanmugapriyas@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-17', facultyName: 'Ms. S. Keerthana', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'keerthanas@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-18', facultyName: 'Mr. P. Vijay', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'vijayp@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-19', facultyName: 'Mrs. M. V. Janani', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'jananimv@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-20', facultyName: 'Mrs. S. Sangeetha', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'sangeethas@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-21', facultyName: 'Mr. C. S. Rajeshkannan', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'rajeshkannancs@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-22', facultyName: 'Mr. R. Manikandan', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'ac@nec.edu.in', roles: ['ACADEMIC_COORDINATOR'], isActive: true },
  { facultyId: 'FWL-23', facultyName: 'Mr. S. Logeswaran', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'logeswarans@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-24', facultyName: 'Ms. V. K. Soundaryaa', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'soundaryaavk@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-25', facultyName: 'Mrs. S. Gomathi', designation: 'Assistant Professor', department: 'Department of Computer Science and Engineering', email: 'gomathis@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-26', facultyName: 'Dr. R. Praveenkumar', designation: 'Associate Professor', department: 'Department of Electronics and Communication Engineering', email: 'praveenkumarr@nec.edu.in', roles: [], isActive: true },
  { facultyId: 'FWL-27', facultyName: 'Ms. B. Preethi', designation: 'Assistant Professor', department: 'Department of Electronics and Communication Engineering', email: 'preethib@nec.edu.in', roles: [], isActive: true },
];

const ALL_FACULTY = [
  ...RAW_CSE_ECE,
  ...MATHEMATICS_FACULTY_MASTER,
  ...ENGLISH_FACULTY_MASTER,
].map((f, idx) => ({
  ...f,
  _id: f._id || `65f0a00000000000000000${(idx + 1).toString(16).padStart(2, '0')}`,
  calculatedTeachingHours: 10 + (idx % 6),
  calculatedResponsibilityHours: 2 + (idx % 4),
  calculatedTotalHours: 12 + (idx % 8),
  status: idx === 3 ? 'REVIEW REQUIRED' : 'MATCHED',
}));

// Academic contexts
const ALL_CONTEXTS = [
  { _id: '65f0c0000000000000000001', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'II Year', section: 'A', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000002', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'II Year', section: 'B', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000003', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'II Year', section: 'C', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000004', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'II Year', section: 'D', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000005', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'III Year', section: 'A', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000006', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'III Year', section: 'B', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000007', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'III Year', section: 'C', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000008', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'III Year', section: 'D', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000009', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'IV Year', section: 'A', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000010', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'IV Year', section: 'B', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000011', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'IV Year', section: 'C', program: 'UG', status: 'ACTIVE' },
  { _id: '65f0c0000000000000000012', academicYear: '2026-27', semester: 'Odd Semester', department: 'CSE', year: 'IV Year', section: 'D', program: 'UG', status: 'ACTIVE' },
];

const DEFAULT_ACTIVE_CONTEXT = ALL_CONTEXTS[4]; // III Year CSE A

// Workloads list for 27 faculty
const ALL_WORKLOADS = RAW_CSE_ECE.map((f, idx) => ({
  _id: `65f0b00000000000000000${(idx + 1).toString(16).padStart(2, '0')}`,
  facultyId: f.facultyId,
  facultyName: f.facultyName,
  designation: f.designation,
  sourceTeachingHours: 12,
  sourceResponsibilityHours: 4,
  sourceTotalHours: 16,
  calculatedTeachingHours: 12,
  calculatedResponsibilityHours: 4,
  calculatedTotalHours: 16,
  status: idx === 3 ? 'REVIEW REQUIRED' : 'MATCHED',
  isIncomplete: false,
  teaching: {
    ugTheory1: [
      {
        category: 'UG Theory 1',
        courseCode: '22CSC16',
        courseName: 'Object Oriented Software Engineering',
        allocation: 'UG III Year A',
        hours: 3,
        year: 'III Year',
        section: 'A',
      },
    ],
    ugTheory2: [
      {
        category: 'UG Theory 2',
        courseCode: '22CSC15',
        courseName: 'Full Stack Development',
        allocation: 'UG III Year B',
        hours: 3,
        year: 'III Year',
        section: 'B',
      },
    ],
    lab1: [
      {
        category: 'Lab 1',
        courseCode: '22CSP09',
        courseName: 'Full Stack Development Laboratory',
        allocation: 'UG III Year A',
        hours: 3,
        year: 'III Year',
        section: 'A',
      },
    ],
    lab2: [],
    pg: [],
    others: [],
  },
  responsibilities: [
    {
      role: f.roles.includes('ACADEMIC_COORDINATOR') ? 'Academic Coordinator' : f.roles.includes('HOD') ? 'Head of Department' : 'Class Advisor',
      category: 'Academic',
      allocation: 'Department',
      hours: 4,
    },
  ],
}));

// Published Timetable version
const ALL_TIMETABLE_VERSIONS = [
  {
    _id: '65f0d0000000000000000001',
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
    approvedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    hardConflicts: 0,
    totalScheduledPeriods: 35,
    academicContextId: ALL_CONTEXTS[4]._id,
  },
];

// Timetable sessions for III-A
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
const SAMPLE_COURSES = [
  { code: '22CSC16', name: 'Object Oriented Software Engineering', facultyId: 'FWL-03', facultyName: 'Dr. S. Karpusamy' },
  { code: '22CSC15', name: 'Full Stack Development', facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi' },
  { code: '22CSX42', name: 'UI and UX Design', facultyId: 'FWL-06', facultyName: 'Mrs. E. Padma' },
  { code: '22CSC14', name: 'Principles of Compiler Design', facultyId: 'FWL-04', facultyName: 'Dr. A. Manchula' },
  { code: '22CSX21', name: 'Fundamentals of Cryptography and Network Security', facultyId: 'FWL-12', facultyName: 'Mrs. K. Eswari' },
  { code: '22CSP09', name: 'Full Stack Development Laboratory', facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi', isLab: true },
];

const ALL_SESSIONS = [];
let sessionCounter = 1;
DAYS.forEach((day, dIdx) => {
  PERIODS.forEach((period, pIdx) => {
    const isLabSlot = (day === 'WED' && (pIdx >= 4)) || (day === 'FRI' && (pIdx >= 4));
    const course = isLabSlot ? SAMPLE_COURSES[5] : SAMPLE_COURSES[(dIdx + pIdx) % 5];
    ALL_SESSIONS.push({
      _id: `65f0e00000000000000000${(sessionCounter++).toString(16).padStart(2, '0')}`,
      timetableVersionId: ALL_TIMETABLE_VERSIONS[0]._id,
      academicContextId: ALL_CONTEXTS[4]._id,
      day,
      period,
      courseCode: course.code,
      courseName: course.name,
      facultyId: course.facultyId,
      facultyName: course.facultyName,
      room: isLabSlot ? 'CSE LAB 3' : 'LH-101',
      sessionType: isLabSlot ? 'LAB' : 'THEORY',
      duration: 1,
    });
  });
});

// Candidate handlers
const ALL_HANDLERS = [
  {
    _id: '65f0f0000000000000000001',
    courseCode: '22CSC14',
    courseName: 'Principles of Compiler Design',
    candidateFacultyIds: ['FWL-04', 'FWL-07', 'FWL-14'],
    preferredFacultyId: 'FWL-04',
    remarks: 'Approved for Principles of Compiler Design',
    submittedBy: 'Mr. R. Manikandan (AC)',
  },
  {
    _id: '65f0f0000000000000000002',
    courseCode: '22CSP09',
    courseName: 'Full Stack Development Laboratory',
    candidateFacultyIds: ['FWL-01', 'FWL-03', 'FWL-06'],
    preferredFacultyId: 'FWL-03',
    remarks: 'Approved Full Stack Development Lab handlers',
    submittedBy: 'Mr. R. Manikandan (AC)',
  },
  {
    _id: '65f0f0000000000000000003',
    courseCode: '22CSC06',
    courseName: 'Computer Networks',
    candidateFacultyIds: ['FWL-02', 'FWL-05', 'FWL-18'],
    preferredFacultyId: 'FWL-02',
    remarks: 'Approved Computer Networks candidates',
    submittedBy: 'Mr. R. Manikandan (AC)',
  },
];

// Notifications
const ALL_NOTIFICATIONS = [
  {
    _id: '65f0n0000000000000000001',
    title: 'Timetable Published',
    message: 'Official Timetable Version 1.0 for III Year CSE Section A is now live.',
    type: 'INFO',
    createdAt: new Date().toISOString(),
    read: false,
  },
  {
    _id: '65f0n0000000000000000002',
    title: 'Workload Master Review',
    message: 'Workload distribution synchronized across CSE, Mathematics, and English departments.',
    type: 'SUCCESS',
    createdAt: new Date().toISOString(),
    read: false,
  },
];

/**
 * Resolver for GET requests when MongoDB is offline
 */
function handleOfflineGet(path, query = {}) {
  const p = path.replace(/\/$/, '');

  // 1. Academic Contexts
  if (p === '/api/academic-contexts/active' || p === '/academic-contexts/active') {
    return DEFAULT_ACTIVE_CONTEXT;
  }
  if (p === '/api/academic-contexts' || p === '/academic-contexts') {
    let result = [...ALL_CONTEXTS];
    if (query.year) result = result.filter(c => c.year === query.year);
    if (query.section) result = result.filter(c => c.section === query.section);
    return result;
  }
  if (p.startsWith('/api/academic-contexts/') || p.startsWith('/academic-contexts/')) {
    const id = p.split('/').pop();
    const ctx = ALL_CONTEXTS.find(c => c._id === id || c.year === id);
    return ctx || DEFAULT_ACTIVE_CONTEXT;
  }

  // 2. Faculty
  if (p === '/api/faculty' || p === '/faculty') {
    let items = [...ALL_FACULTY];
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(f => f.facultyName.toLowerCase().includes(q) || f.facultyId.toLowerCase().includes(q) || f.designation.toLowerCase().includes(q));
    }
    if (query.department) {
      items = items.filter(f => f.department.toLowerCase().includes(query.department.toLowerCase()));
    }
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 50;
    const startIndex = (page - 1) * limit;
    const paginated = items.slice(startIndex, startIndex + limit);
    return {
      items: paginated,
      total: items.length,
      page,
      limit,
      totalPages: Math.ceil(items.length / limit) || 1,
    };
  }
  if (p.startsWith('/api/faculty/') || p.startsWith('/faculty/')) {
    const idOrFid = p.split('/').pop();
    const fac = ALL_FACULTY.find(f => f.facultyId === idOrFid || f._id === idOrFid);
    return fac || ALL_FACULTY[0];
  }

  // 3. Workload
  if (p === '/api/workload/summary' || p === '/workload/summary') {
    return {
      totalFaculty: ALL_WORKLOADS.length,
      totalTeachingHours: 296,
      totalResponsibilityHours: 92,
      totalAllocatedHours: 388,
      completeCount: ALL_WORKLOADS.length - 1,
      incompleteCount: 0,
      discrepancyCount: 1,
    };
  }
  if (p === '/api/workload/discrepancies' || p === '/workload/discrepancies') {
    const disc = ALL_WORKLOADS.filter(w => w.status === 'REVIEW REQUIRED');
    return { count: disc.length, items: disc };
  }
  if (p === '/api/workload/incomplete' || p === '/workload/incomplete') {
    return { count: 0, items: [] };
  }
  if (p === '/api/workload' || p === '/workload') {
    let items = [...ALL_WORKLOADS];
    if (query.facultyId) items = items.filter(w => w.facultyId === query.facultyId);
    if (query.status && query.status !== 'all') items = items.filter(w => w.status === query.status);
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;
    return {
      items: items.slice(startIndex, startIndex + limit),
      total: items.length,
      page,
      limit,
      totalPages: Math.ceil(items.length / limit) || 1,
    };
  }

  // 4. Courses
  if (p === '/api/courses' || p === '/courses') {
    let courses = [...R22_CSE_CURRICULUM_COURSES];
    if (query.semester) {
      courses = courses.filter(c => c.semester === query.semester);
    }
    if (query.category) {
      courses = courses.filter(c => c.category === query.category);
    }
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 100;
    const startIndex = (page - 1) * limit;
    return {
      items: courses.slice(startIndex, startIndex + limit),
      total: courses.length,
      page,
      limit,
      totalPages: Math.ceil(courses.length / limit) || 1,
    };
  }

  // 5. Timetable
  if (p === '/api/timetable/versions' || p === '/timetable/versions') {
    return ALL_TIMETABLE_VERSIONS;
  }
  if (p.includes('/timetable/faculty/')) {
    const rawId = p.split('/').pop().split('?')[0];
    const facSessions = ALL_SESSIONS.filter(s => s.facultyId === rawId || rawId === 'FWL-03' || rawId === 'FWL-01');
    return {
      facultyId: rawId,
      sessionCount: facSessions.length,
      sessions: facSessions,
      version: ALL_TIMETABLE_VERSIONS[0],
    };
  }
  if (p.includes('/timetable/class/') || p.includes('/timetable/published/')) {
    const rawId = p.split('/').pop().split('?')[0];
    return {
      academicContextId: rawId,
      sessionCount: ALL_SESSIONS.length,
      sessions: ALL_SESSIONS,
      version: ALL_TIMETABLE_VERSIONS[0],
    };
  }
  if (p.includes('/timetable/context-status') || p.includes('/timetable/status')) {
    return {
      academicContextId: p.split('/').pop().split('?')[0],
      hasDraft: true,
      hasPublished: true,
      status: 'PUBLISHED',
      latestVersion: ALL_TIMETABLE_VERSIONS[0],
    };
  }
  if (p.includes('/timetable/review-matrix') || p.includes('/timetable/matrix')) {
    return {
      version: ALL_TIMETABLE_VERSIONS[0],
      academicContext: DEFAULT_ACTIVE_CONTEXT,
      sessions: ALL_SESSIONS,
    };
  }
  if (p === '/api/timetable/sessions' || p === '/timetable/sessions') {
    let sessions = [...ALL_SESSIONS];
    if (query.facultyId) sessions = sessions.filter(s => s.facultyId === query.facultyId);
    if (query.day) sessions = sessions.filter(s => s.day === query.day);
    return sessions;
  }
  if (p === '/api/timetable/grid' || p === '/timetable/grid') {
    return {
      version: ALL_TIMETABLE_VERSIONS[0],
      academicContext: DEFAULT_ACTIVE_CONTEXT,
      sessions: ALL_SESSIONS,
    };
  }

  // 6. Course Faculty Handlers
  if (p === '/api/course-faculty-handlers' || p === '/course-faculty-handlers') {
    return ALL_HANDLERS;
  }

  // 7. Notifications
  if (p === '/api/notifications' || p === '/notifications') {
    return ALL_NOTIFICATIONS;
  }

  // 8. Availability & Absences & Substitutes
  if (p.includes('/availability')) {
    return [];
  }
  if (p.includes('/absences') || p.includes('/substitutes')) {
    return [];
  }

  // 9. Regulations
  if (p.includes('/regulation')) {
    return {
      regulation: 'R22',
      department: 'CSE',
      curriculum: '2024-2025 Onwards',
      totalCredits: 165,
      semesters: 8,
      electives: R22_ELECTIVE_SLOT_MAP,
      verticals: R22_PEC_VERTICALS,
    };
  }

  // Generic array/object fallback
  return p.endsWith('s') ? [] : {};
}

module.exports = {
  ALL_FACULTY,
  ALL_CONTEXTS,
  DEFAULT_ACTIVE_CONTEXT,
  ALL_WORKLOADS,
  ALL_TIMETABLE_VERSIONS,
  ALL_SESSIONS,
  ALL_HANDLERS,
  ALL_NOTIFICATIONS,
  handleOfflineGet,
};
