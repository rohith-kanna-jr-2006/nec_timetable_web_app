/**
 * Academic year range helpers (Phase 8).
 *
 * The canonical backend representation of an academic year is an explicit pair:
 *
 *   academicYearFrom = 2026
 *   academicYearTo   = 2027
 *
 * The legacy single string 'academicYear' is only a derived compatibility
 * mirror. Every existing record in this repository uses exactly one canonical
 * format, 'YYYY-YY' (verified against the live AcademicContext collection), so the
 * conversion in both directions is deterministic and total for that format.
 *
 * Anything outside that format is rejected rather than guessed, because a wrong
 * guess would silently corrupt the identity of an AcademicContext.
 */

const CANONICAL_PATTERN = /^(\d{4})-(\d{2})$/;

/**
 * Parses the legacy 'YYYY-YY' academic year string into a from/to pair.
 * Returns null when the value is absent or not in the canonical format.
 */
function parseAcademicYear(academicYear) {
  if (academicYear === null || academicYear === undefined) return null;
  if (typeof academicYear === 'number' && Number.isInteger(academicYear)) {
    // A bare year is not a range and is therefore not a valid academic year here.
    return null;
  }
  if (typeof academicYear !== 'string') return null;

  const match = CANONICAL_PATTERN.exec(academicYear.trim());
  if (!match) return null;

  const from = Number(match[1]);
  const shortTo = Number(match[2]);

  // The two-digit suffix encodes the ENDING year. Interpret it in the century of
  // the opening year first ('2026-27' -> 2027, '1999-00' -> 2000), and only step
  // into the following century when that would not be after the opening year
  // ('2099-00' -> 2100). This keeps format -> parse a total round trip.
  let to = 2000 + shortTo;
  if (to <= from) {
    to = (Math.floor(from / 100) + 1) * 100 + shortTo;
  }
  if (!isValidRange(from, to)) return null;

  return { academicYearFrom: from, academicYearTo: to };
}

/**
 * Renders the compatibility mirror string for a from/to pair, e.g. 2026/2027
 * becomes '2026-27'. Returns null when the pair is not a valid range.
 */
function formatAcademicYear(academicYearFrom, academicYearTo) {
  if (!isValidRange(academicYearFrom, academicYearTo)) return null;
  const from = Number(academicYearFrom);
  const to = Number(academicYearTo);
  const short = to % 100;
  return `${from}-${String(short).padStart(2, '0')}`;
}

/**
 * True when the pair is two integers describing one academic-year range with
 * from strictly less than to. from == to, from > to and a missing side are all
 * invalid by design.
 */
function isValidRange(academicYearFrom, academicYearTo) {
  if (!Number.isInteger(academicYearFrom) || !Number.isInteger(academicYearTo)) return false;
  return academicYearFrom < academicYearTo;
}

/**
 * Normalises any accepted input shape into the canonical pair.
 * Accepts an explicit from/to pair or the legacy 'YYYY-YY' string.
 * Returns null when the input cannot be resolved deterministically.
 */
function resolveAcademicYearRange(input = {}) {
  const { academicYearFrom, academicYearTo, academicYear } = input;

  const hasFrom = academicYearFrom !== undefined && academicYearFrom !== null && academicYearFrom !== '';
  const hasTo = academicYearTo !== undefined && academicYearTo !== null && academicYearTo !== '';

  if (hasFrom || hasTo) {
    if (!hasFrom || !hasTo) return null; // half a range is never valid
    const from = Number(academicYearFrom);
    const to = Number(academicYearTo);
    if (!isValidRange(from, to)) return null;
    return { academicYearFrom: from, academicYearTo: to };
  }

  return parseAcademicYear(academicYear);
}

module.exports = {
  parseAcademicYear,
  formatAcademicYear,
  isValidRange,
  resolveAcademicYearRange,
  CANONICAL_PATTERN,
};