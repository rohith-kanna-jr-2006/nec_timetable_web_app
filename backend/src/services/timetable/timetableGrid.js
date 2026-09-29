/**
 * Standard Collegiate Timetable Grid Configuration and Utilities
 *
 * Defines authoritative days, periods, morning/afternoon sessions,
 * break boundaries, and block validation rules.
 */

const DEFAULT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const DEFAULT_PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];

const MORNING_PERIODS = ['P1', 'P2', 'P3', 'P4'];
const AFTERNOON_PERIODS = ['P5', 'P6', 'P7', 'P8'];

// Break definitions: lunch interval is between P4 and P5
const MAJOR_BREAKS = [
  { afterPeriod: 'P4', name: 'Lunch Interval', morningBound: 'P4', afternoonBound: 'P5' },
];

/**
 * Returns period index in list of periods
 */
function getPeriodIndex(period, periods = DEFAULT_PERIODS) {
  return periods.indexOf(period);
}

/**
 * Checks if a set of periods is completely within the morning session
 */
function isMorningBlock(periods) {
  return periods.every((p) => MORNING_PERIODS.includes(p));
}

/**
 * Checks if a set of periods is completely within the afternoon session
 */
function isAfternoonBlock(periods) {
  return periods.every((p) => AFTERNOON_PERIODS.includes(p));
}

/**
 * Checks whether a consecutive span of periods crosses a break (e.g., lunch break)
 */
function crossesBreak(periods) {
  // If block contains both a morning period and an afternoon period, it crosses the lunch break
  const hasMorning = periods.some((p) => MORNING_PERIODS.includes(p));
  const hasAfternoon = periods.some((p) => AFTERNOON_PERIODS.includes(p));
  return hasMorning && hasAfternoon;
}

/**
 * Checks if periods are strictly consecutive
 */
function arePeriodsConsecutive(periods, allPeriods = DEFAULT_PERIODS) {
  if (!periods || periods.length <= 1) return true;
  for (let i = 0; i < periods.length - 1; i++) {
    const idxCurrent = allPeriods.indexOf(periods[i]);
    const idxNext = allPeriods.indexOf(periods[i + 1]);
    if (idxCurrent === -1 || idxNext === -1 || idxNext !== idxCurrent + 1) {
      return false;
    }
  }
  return true;
}

/**
 * Generates all valid continuous lab blocks of length `blockSize` for a given day
 * that do NOT cross any major breaks.
 */
function getValidLabBlocksForDay(day, blockSize = 4, allPeriods = DEFAULT_PERIODS) {
  const blocks = [];
  const n = allPeriods.length;

  for (let i = 0; i <= n - blockSize; i++) {
    const candidatePeriods = allPeriods.slice(i, i + blockSize);

    // Hard check 1: consecutive
    if (!arePeriodsConsecutive(candidatePeriods, allPeriods)) continue;

    // Hard check 2: must not cross a major break (e.g. lunch interval)
    if (crossesBreak(candidatePeriods)) continue;

    // Determine session
    const isMorning = isMorningBlock(candidatePeriods);
    const isAfternoon = isAfternoonBlock(candidatePeriods);

    if (isMorning || isAfternoon) {
      blocks.push({
        day,
        periods: candidatePeriods,
        session: isMorning ? 'MORNING' : 'AFTERNOON',
        duration: blockSize,
      });
    }
  }

  return blocks;
}

module.exports = {
  DEFAULT_DAYS,
  DEFAULT_PERIODS,
  MORNING_PERIODS,
  AFTERNOON_PERIODS,
  MAJOR_BREAKS,
  getPeriodIndex,
  isMorningBlock,
  isAfternoonBlock,
  crossesBreak,
  arePeriodsConsecutive,
  getValidLabBlocksForDay,
};
