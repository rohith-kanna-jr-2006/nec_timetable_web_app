/**
 * Authoritative Institutional Responsibility Master List
 *
 * Sourced directly from the 27-Faculty Allocation Master Register.
 * Exactly 38 recognized institutional roles for CSE department.
 */

const RESPONSIBILITY_MASTER_ROLES = [
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

const RESPONSIBILITY_MASTER_MAP = new Map(
  RESPONSIBILITY_MASTER_ROLES.map((r) => [r.toLowerCase(), r])
);

function isValidResponsibilityRole(role) {
  if (!role || typeof role !== 'string') return false;
  return RESPONSIBILITY_MASTER_MAP.has(role.trim().toLowerCase());
}

function getCanonicalRoleName(role) {
  if (!role || typeof role !== 'string') return role;
  return RESPONSIBILITY_MASTER_MAP.get(role.trim().toLowerCase()) || role.trim();
}

module.exports = {
  RESPONSIBILITY_MASTER_ROLES,
  RESPONSIBILITY_MASTER_MAP,
  isValidResponsibilityRole,
  getCanonicalRoleName,
};
