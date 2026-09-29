/**
 * Candidate Generator with Rigid Hard-Constraint Filtering
 *
 * Generates and filters candidate slots/blocks for both Laboratories and Theory courses.
 * Enforces:
 * - Zero class double-booking
 * - Zero global faculty double-booking
 * - Faculty availability status compliance
 * - Unbroken 4-period continuous lab blocks
 * - No lab block crossing lunch break
 * - Multi-lab rule (at least one lab in afternoon if labs > 1)
 * - Theory max consecutive limit (< 3 same-subject periods)
 */

const {
  getValidLabBlocksForDay,
  isMorningBlock,
  isAfternoonBlock,
} = require('./timetableGrid');

/**
 * Checks if placing a theory course at day + period causes >= 3 consecutive periods of that course.
 */
function wouldCreateThreeConsecutiveTheory(day, period, courseCode, classOccupancy, allPeriods) {
  const idx = allPeriods.indexOf(period);
  if (idx === -1) return false;

  const getCourseAt = (pIndex) => {
    if (pIndex < 0 || pIndex >= allPeriods.length) return null;
    const p = allPeriods[pIndex];
    const session = classOccupancy.get(`${day}_${p}`);
    return session ? session.courseCode : null;
  };

  const prev2 = getCourseAt(idx - 2);
  const prev1 = getCourseAt(idx - 1);
  const next1 = getCourseAt(idx + 1);
  const next2 = getCourseAt(idx + 2);

  // Case 1: [idx-2, idx-1, idx]
  if (prev2 === courseCode && prev1 === courseCode) return true;

  // Case 2: [idx-1, idx, idx+1]
  if (prev1 === courseCode && next1 === courseCode) return true;

  // Case 3: [idx, idx+1, idx+2]
  if (next1 === courseCode && next2 === courseCode) return true;

  return false;
}

/**
 * Counts how many periods of courseCode are already scheduled on this day
 */
function getCourseCountOnDay(day, courseCode, classOccupancy, allPeriods) {
  let count = 0;
  for (const p of allPeriods) {
    const session = classOccupancy.get(`${day}_${p}`);
    if (session && session.courseCode === courseCode) {
      count++;
    }
  }
  return count;
}

/**
 * Generates valid candidate blocks for a LABORATORY variable.
 */
function generateLabCandidates(variable, state, context) {
  const { gridConfig, totalLabsCount } = context;
  const { days, periods } = gridConfig;
  const { classOccupancy, globalFacultyOccupancy, facultyUnavailableSet, scheduledLabs } = state;

  const candidates = [];
  const duration = variable.duration || 4;

  // Check how many labs have already been scheduled in the afternoon
  const afternoonLabsScheduled = scheduledLabs.filter((lab) => lab.session === 'AFTERNOON').length;
  const remainingLabsCount = totalLabsCount - scheduledLabs.length;
  const mustBeAfternoon = totalLabsCount > 1 && afternoonLabsScheduled === 0 && remainingLabsCount === 1;

  for (const day of days) {
    const validBlocks = getValidLabBlocksForDay(day, duration, periods);

    for (const block of validBlocks) {
      // Multi-lab rule enforcement: if this is the last lab and no afternoon lab yet, MUST be afternoon!
      if (mustBeAfternoon && block.session !== 'AFTERNOON') {
        continue;
      }

      // Check each period in the block
      let blockValid = true;

      for (const p of block.periods) {
        const classSlotKey = `${day}_${p}`;
        const facultySlotKey = `${variable.facultyId}_${day}_${p}`;

        // 1. Class conflict
        if (classOccupancy.has(classSlotKey)) {
          blockValid = false;
          break;
        }

        // 2. Global faculty conflict
        if (globalFacultyOccupancy.has(facultySlotKey)) {
          blockValid = false;
          break;
        }

        // 3. Faculty availability
        if (facultyUnavailableSet.has(facultySlotKey)) {
          blockValid = false;
          break;
        }
      }

      if (blockValid) {
        candidates.push({
          day,
          periods: block.periods,
          session: block.session,
          duration,
          isLab: true,
          variableId: variable.id,
          courseCode: variable.courseCode,
          facultyId: variable.facultyId,
        });
      }
    }
  }

  return candidates;
}

/**
 * Generates valid candidate single-period slots for a THEORY variable.
 */
function generateTheoryCandidates(variable, state, context) {
  const { gridConfig } = context;
  const { days, periods } = gridConfig;
  const { classOccupancy, globalFacultyOccupancy, facultyUnavailableSet } = state;

  const candidates = [];

  for (const day of days) {
    // Session concentration safeguard: if course already has >= 2 periods on this day, avoid 3rd
    const currentDayCount = getCourseCountOnDay(day, variable.courseCode, classOccupancy, periods);
    if (currentDayCount >= 2) {
      continue;
    }

    for (const period of periods) {
      const classSlotKey = `${day}_${period}`;
      const facultySlotKey = `${variable.facultyId}_${day}_${period}`;

      // 1. Class conflict
      if (classOccupancy.has(classSlotKey)) {
        continue;
      }

      // 2. Global faculty conflict
      if (globalFacultyOccupancy.has(facultySlotKey)) {
        continue;
      }

      // 3. Faculty availability
      if (facultyUnavailableSet.has(facultySlotKey)) {
        continue;
      }

      // 4. Theory consecutive rule: must not create >= 3 consecutive periods of same course
      if (wouldCreateThreeConsecutiveTheory(day, period, variable.courseCode, classOccupancy, periods)) {
        continue;
      }

      const isMorning = isMorningBlock([period]);
      candidates.push({
        day,
        period,
        periods: [period],
        session: isMorning ? 'MORNING' : 'AFTERNOON',
        duration: 1,
        isLab: false,
        variableId: variable.id,
        courseCode: variable.courseCode,
        facultyId: variable.facultyId,
      });
    }
  }

  return candidates;
}

/**
 * Master candidate generator for any variable (Lab or Theory)
 */
function generateCandidatesForVariable(variable, state, context) {
  if (variable.isLab) {
    return generateLabCandidates(variable, state, context);
  }
  return generateTheoryCandidates(variable, state, context);
}

module.exports = {
  generateLabCandidates,
  generateTheoryCandidates,
  generateCandidatesForVariable,
  wouldCreateThreeConsecutiveTheory,
  getCourseCountOnDay,
};
