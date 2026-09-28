/**
 * Authoritative Institutional Responsibility Master List (38 Roles)
 * Sourced directly from the NEC 27-Faculty Allocation Master & Backend Validators.
 */

export const RESPONSIBILITY_MASTER_ROLES = [
  'AI Affiliation/AICTE Work',
  'Admin Coordinator',
  'Alumni & Higher Studies',
  'CC1 Lab I/C',
  'CC1 Lab Incharge',
  'CCI Lab Incharge',
  'Class Advisor',
  'DCOE',
  'Dept. Association',
  'Dept. CFiR and RSD Coordinator',
  'Dept. CIPD Coordinator',
  'Dept. Exam Cell I/C',
  'Dept. Infrastructure / Maintenance / Furniture',
  'Dept. Meeting Minutes',
  'Dept. Newsletter/Magazine',
  'Faculty Achievements',
  'Industrial Relations Coordinator',
  'Institute Social Media and Website Updation',
  'MOU/Internship',
  'NAAC/NBA Coordinator',
  'NBA Coordinator',
  'NIRF/IQAC Coordinator',
  'NPTEL Online Courses (Faculty & Students)',
  'One Credit Course',
  'Overall Academic Coordinator',
  'P&EA Coordinator',
  'PAC, DAB, BoS Coordinator',
  'PCD Club',
  'Placement Coordinator',
  'Proctor',
  'Professional Society/Chapter',
  'Startups & Business Incubation / Entrepreneur',
  'Student Achievements',
  'Student Affairs Coordinator',
  'Student Exit Survey',
  'TECH GURU',
  'Timetable Coordinator',
  'Timetable I/C',
];

export const RESPONSIBILITY_CATEGORIES = {
  Academic: [
    'Class Advisor',
    'Proctor',
    'Overall Academic Coordinator',
    'Student Affairs Coordinator',
    'One Credit Course',
    'NPTEL Online Courses (Faculty & Students)',
    'Student Exit Survey',
  ],
  Administrative: [
    'Admin Coordinator',
    'DCOE',
    'Dept. Exam Cell I/C',
    'CC1 Lab I/C',
    'CC1 Lab Incharge',
    'CCI Lab Incharge',
    'AI Affiliation/AICTE Work',
    'Dept. Infrastructure / Maintenance / Furniture',
    'Dept. Meeting Minutes',
  ],
  Coordination: [
    'Timetable Coordinator',
    'Timetable I/C',
    'NBA Coordinator',
    'NAAC/NBA Coordinator',
    'NIRF/IQAC Coordinator',
    'Dept. CIPD Coordinator',
    'Dept. CFiR and RSD Coordinator',
    'PAC, DAB, BoS Coordinator',
    'P&EA Coordinator',
    'Placement Coordinator',
    'Industrial Relations Coordinator',
    'MOU/Internship',
  ],
  Institutional: [
    'TECH GURU',
    'Dept. Association',
    'Dept. Newsletter/Magazine',
    'Institute Social Media and Website Updation',
    'Faculty Achievements',
    'Student Achievements',
    'Alumni & Higher Studies',
    'PCD Club',
    'Professional Society/Chapter',
    'Startups & Business Incubation / Entrepreneur',
  ],
};

const ROLE_SET_LOWER = new Set(
  RESPONSIBILITY_MASTER_ROLES.map((r) => r.toLowerCase().trim())
);

export function isValidResponsibilityRole(role) {
  if (!role || typeof role !== 'string') return false;
  return ROLE_SET_LOWER.has(role.toLowerCase().trim());
}

export function classifyResponsibility(role) {
  if (!role) return 'Institutional';
  const r = role.toLowerCase().trim();

  // Academic
  if (
    r.includes('academic coordinator') ||
    r.includes('class advisor') ||
    r.includes('proctor') ||
    r.includes('student affairs') ||
    r.includes('one credit') ||
    r.includes('exit survey')
  ) {
    return 'Academic';
  }

  // Administrative
  if (
    r.includes('admin') ||
    r.includes('lab incharge') ||
    r.includes('lab i/c') ||
    r.includes('dcoe') ||
    r.includes('exam cell') ||
    r.includes('aicte') ||
    r.includes('affiliation') ||
    r.includes('infrastructure') ||
    r.includes('maintenance') ||
    r.includes('minutes')
  ) {
    return 'Administrative';
  }

  // Coordination
  if (
    r.includes('nba') ||
    r.includes('naac') ||
    r.includes('cipd') ||
    r.includes('bos') ||
    r.includes('p&ea') ||
    r.includes('nirf') ||
    r.includes('iqac') ||
    r.includes('timetable') ||
    r.includes('placement') ||
    r.includes('industrial relations') ||
    r.includes('mou') ||
    r.includes('internship') ||
    r.includes('cfir') ||
    r.includes('rsd') ||
    r.includes('nptel')
  ) {
    return 'Coordination';
  }

  return 'Institutional';
}

export const FACULTY_DESIGNATIONS = [
  'Professor & Head',
  'Professor',
  'Associate Professor',
  'Assistant Professor (Senior Grade)',
  'Assistant Professor',
];

export const STANDARD_ALLOCATIONS = [
  'UG I Year A',
  'UG I Year B',
  'UG II Year A',
  'UG II Year B',
  'UG II Year C',
  'UG III Year A',
  'UG III Year B',
  'UG III Year C',
  'UG IV Year A',
  'UG IV Year B',
  'PG I Year',
  'PG II Year',
  'Department',
  'Campus',
];

export const DEFAULT_DEPARTMENT = 'Department of Computer Science and Engineering';
