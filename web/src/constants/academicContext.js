/**
 * Centralized Academic Context & Curriculum Mapping for NEC Timetable System
 * Authoritative mapping for R22 Computer Science and Engineering regulations.
 */

export const RELEVANT_YEARS = ['II Year', 'III Year', 'IV Year'];

export const YEAR_TO_SEMESTER_ODD = {
  'I': 'Semester I',
  'I Year': 'Semester I',
  'II': 'Semester III',
  'II Year': 'Semester III',
  'III': 'Semester V',
  'III Year': 'Semester V',
  'IV': 'Semester VII',
  'IV Year': 'Semester VII',
};

export const YEAR_TO_SEMESTER_EVEN = {
  'I': 'Semester II',
  'I Year': 'Semester II',
  'II': 'Semester IV',
  'II Year': 'Semester IV',
  'III': 'Semester VI',
  'III Year': 'Semester VI',
  'IV': 'Semester VIII',
  'IV Year': 'Semester VIII',
};

export const YEAR_SEMESTER_MAP = {
  'II Year': ['Semester III', 'Semester IV'],
  'III Year': ['Semester V', 'Semester VI'],
  'IV Year': ['Semester VII', 'Semester VIII'],
};

export const CURRICULUM_SEMESTER_TO_PERIOD = {
  'Semester I': 'Odd Semester',
  'Semester II': 'Even Semester',
  'Semester III': 'Odd Semester',
  'Semester IV': 'Even Semester',
  'Semester V': 'Odd Semester',
  'Semester VI': 'Even Semester',
  'Semester VII': 'Odd Semester',
  'Semester VIII': 'Even Semester',
};

/**
 * Normalizes year string (e.g. 'III' -> 'III Year', 'III Year' -> 'III Year')
 */
export function normalizeYear(year) {
  if (!year) return '';
  const y = String(year).trim();
  if (['I', 'II', 'III', 'IV'].includes(y)) {
    return `${y} Year`;
  }
  return y;
}

/**
 * Normalizes semester string to curriculum format (e.g. '5' -> 'Semester V', 'Semester 5' -> 'Semester V')
 */
export function normalizeCurriculumSemester(sem) {
  if (!sem) return '';
  const s = String(sem).trim();
  const romanMap = {
    '1': 'Semester I', 'I': 'Semester I',
    '2': 'Semester II', 'II': 'Semester II',
    '3': 'Semester III', 'III': 'Semester III',
    '4': 'Semester IV', 'IV': 'Semester IV',
    '5': 'Semester V', 'V': 'Semester V',
    '6': 'Semester VI', 'VI': 'Semester VI',
    '7': 'Semester VII', 'VII': 'Semester VII',
    '8': 'Semester VIII', 'VIII': 'Semester VIII',
  };
  const clean = s.replace(/^(semester|sem)\.?\s*/i, '').trim().toUpperCase();
  return romanMap[clean] || s;
}

/**
 * Resolves curriculum semester (e.g. 'Semester V') from year and term/semester string.
 * Prevents "Odd Semester" from being erroneously passed to course queries.
 */
export function resolveCurriculumSemester(year, termOrSemester = 'Odd Semester') {
  if (!year) return '';
  const cleanYear = normalizeYear(year);

  // If termOrSemester is already a direct curriculum semester, normalize and return it
  if (/^semester\s+[IVX0-9]+/i.test(termOrSemester)) {
    return normalizeCurriculumSemester(termOrSemester);
  }

  const isEven = /even|IV|VI|VIII|4|6|8/i.test(termOrSemester);
  const map = isEven ? YEAR_TO_SEMESTER_EVEN : YEAR_TO_SEMESTER_ODD;
  return map[cleanYear] || 'Semester III';
}

/**
 * Matches an AcademicContext from context list based on year, semester/curriculumSemester, section, department
 */
export function findMatchingAcademicContext(contexts = [], { year, semester, section, department = 'CSE' }) {
  if (!Array.isArray(contexts) || contexts.length === 0) return null;

  const targetYear = normalizeYear(year);
  const isEven = /even|IV|VI|VIII|4|6|8/i.test(semester);
  const targetSection = (section || 'A').toUpperCase().trim();
  const targetDept = (department || 'CSE').toUpperCase().trim();

  return (
    contexts.find((c) => {
      const cYear = normalizeYear(c.year);
      const cDept = (c.department || '').toUpperCase().trim();
      const cSec = (c.section || '').toUpperCase().trim();
      const cSemIsEven = /even/i.test(c.semester);

      const matchesYear = cYear === targetYear;
      const matchesDept = !targetDept || cDept === targetDept;
      const matchesSec = cSec === targetSection;
      const matchesPeriod = isEven ? cSemIsEven : !cSemIsEven;

      return matchesYear && matchesDept && matchesSec && matchesPeriod;
    }) || null
  );
}

export default {
  RELEVANT_YEARS,
  YEAR_TO_SEMESTER_ODD,
  YEAR_TO_SEMESTER_EVEN,
  YEAR_SEMESTER_MAP,
  CURRICULUM_SEMESTER_TO_PERIOD,
  normalizeYear,
  normalizeCurriculumSemester,
  resolveCurriculumSemester,
  findMatchingAcademicContext,
};
