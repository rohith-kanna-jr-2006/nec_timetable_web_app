/**
 * Authoritative Semester and Cohort Year Mapping for NEC CSE (R22)
 *
 * Supports data-driven resolution across all undergraduate study years:
 * Year I   -> Semester I (Odd)  / Semester II (Even)
 * Year II  -> Semester III (Odd) / Semester IV (Even)
 * Year III -> Semester V (Odd)  / Semester VI (Even)
 * Year IV  -> Semester VII (Odd) / Semester VIII (Even)
 */

const NUMERAL_TO_ROMAN = {
  '1': 'I', 'I': 'I',
  '2': 'II', 'II': 'II',
  '3': 'III', 'III': 'III',
  '4': 'IV', 'IV': 'IV',
  '5': 'V', 'V': 'V',
  '6': 'VI', 'VI': 'VI',
  '7': 'VII', 'VII': 'VII',
  '8': 'VIII', 'VIII': 'VIII',
};

const ODD_YEAR_MAP = {
  'I': 'Semester I',
  'II': 'Semester III',
  'III': 'Semester V',
  'IV': 'Semester VII',
};

const EVEN_YEAR_MAP = {
  'I': 'Semester II',
  'II': 'Semester IV',
  'III': 'Semester VI',
  'IV': 'Semester VIII',
};

const SEMESTER_TO_YEAR_MAP = {
  'Semester I': 'I Year',
  'Semester II': 'I Year',
  'Semester III': 'II Year',
  'Semester IV': 'II Year',
  'Semester V': 'III Year',
  'Semester VI': 'III Year',
  'Semester VII': 'IV Year',
  'Semester VIII': 'IV Year',
};

/**
 * Normalizes year string (e.g. 'III Year', '3', 'Year 3', 'III') to Roman ('I'..'IV').
 */
function normalizeYearToRoman(yearStr) {
  if (!yearStr) return null;
  const cleaned = yearStr.toString().trim().toUpperCase().replace(/YEAR/gi, '').trim();
  return NUMERAL_TO_ROMAN[cleaned] || null;
}

/**
 * Normalizes a raw semester string to canonical form ('Semester I'..'Semester VIII').
 */
function normalizeSemesterString(semStr) {
  if (!semStr) return null;
  const match = semStr.toString().trim().match(/^(?:SEM(?:ESTER)?\s*)?([1-8]|I|II|III|IV|V|VI|VII|VIII)$/i);
  if (match) {
    const roman = NUMERAL_TO_ROMAN[match[1].toUpperCase()];
    if (roman) return `Semester ${roman}`;
  }
  return null;
}

/**
 * Resolves the canonical curriculum semester for an AcademicContext.
 *
 * @param {Object} context - AcademicContext document or plain object
 * @returns {string|null} - Canonical semester string ('Semester III', 'Semester V', etc.)
 */
function resolveSemesterForContext(context) {
  if (!context) return null;

  // 1. Direct explicit semester check (e.g. 'Semester V', 'Sem 5')
  const explicit = normalizeSemesterString(context.semester);
  if (explicit) return explicit;

  // 2. Derive from Year and Term (Odd vs Even)
  const romanYear = normalizeYearToRoman(context.year);
  if (!romanYear) return null;

  const isEven = /even/i.test(context.semester || '');
  return isEven ? EVEN_YEAR_MAP[romanYear] || null : ODD_YEAR_MAP[romanYear] || null;
}

/**
 * Resolves cohort year string from a canonical semester string.
 */
function resolveYearForSemester(semester) {
  const norm = normalizeSemesterString(semester);
  return norm ? SEMESTER_TO_YEAR_MAP[norm] || null : null;
}

module.exports = {
  NUMERAL_TO_ROMAN,
  resolveSemesterForContext,
  resolveYearForSemester,
  normalizeSemesterString,
  normalizeYearToRoman,
};
