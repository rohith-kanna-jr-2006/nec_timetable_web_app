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
  MORNING_PERIODS,
  AFTERNOON_PERIODS,
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
    const session = classOccupancy instanceof Map ? classOccupancy.get(`${day}_${p}`) : classOccupancy?.[`${day}_${p}`];
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
 * Checks whether placing courseCode at period on day would fill an entire session (morning or afternoon).
 * Requirement 1: Never fill an entire morning, afternoon, or evening/session with the same theory subject.
 */
function wouldFillEntireSession(day, period, courseCode, classOccupancy, allPeriods) {
  const morningList = allPeriods.filter((p) => MORNING_PERIODS.includes(p));
  const afternoonList = allPeriods.filter((p) => AFTERNOON_PERIODS.includes(p));

  const isMorning = morningList.includes(period);
  const targetSessionPeriods = isMorning ? morningList : afternoonList;

  if (targetSessionPeriods.length === 0) return false;

  let count = 0;
  for (const p of targetSessionPeriods) {
    if (p === period) {
      count++;
    } else {
      const session = classOccupancy instanceof Map ? classOccupancy.get(`${day}_${p}`) : classOccupancy?.[`${day}_${p}`];
      if (session && session.courseCode === courseCode) {
        count++;
      }
    }
  }

  return count >= targetSessionPeriods.length;
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

  const assignedFacultyIds =
    Array.isArray(variable.facultyAssignments) && variable.facultyAssignments.length > 0
      ? variable.facultyAssignments.map((a) => a.facultyId)
      : [variable.facultyId].filter(Boolean);

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

        // 1. Class conflict
        if (classOccupancy.has(classSlotKey)) {
          blockValid = false;
          break;
        }

        // 2 & 3. Global faculty conflict & availability for ALL assigned faculty
        for (const fid of assignedFacultyIds) {
          const facultySlotKey = `${fid}_${day}_${p}`;
          if (globalFacultyOccupancy.has(facultySlotKey) || facultyUnavailableSet.has(facultySlotKey)) {
            blockValid = false;
            break;
          }
        }

        if (!blockValid) {
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
          courseName: variable.courseName,
          facultyId: variable.facultyId,
          facultyName: variable.facultyName,
          facultyAssignments: variable.facultyAssignments,
          room: variable.room,
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
  const assignedFacultyIds =
    Array.isArray(variable.facultyAssignments) && variable.facultyAssignments.length > 0
      ? variable.facultyAssignments.map((a) => a.facultyId)
      : [variable.facultyId].filter(Boolean);

  // Adaptive daily concentration safeguard (max 2 per day for standard courses, scales dynamically if total periods > 2 * days)
  const maxPerDay = Math.max(2, Math.ceil((variable.totalPeriod || 3) / Math.max(1, days.length)));

  for (const day of days) {
    const currentDayCount = getCourseCountOnDay(day, variable.courseCode, classOccupancy, periods);
    if (currentDayCount >= maxPerDay) {
      continue;
    }

    for (const period of periods) {
      const classSlotKey = `${day}_${period}`;

      // 1. Class conflict
      if (classOccupancy.has(classSlotKey)) {
        continue;
      }

      // 2 & 3. Global faculty conflict & availability for ALL assigned faculty
      let facultyHasConflict = false;
      for (const fid of assignedFacultyIds) {
        const facultySlotKey = `${fid}_${day}_${period}`;
        if (globalFacultyOccupancy.has(facultySlotKey) || facultyUnavailableSet.has(facultySlotKey)) {
          facultyHasConflict = true;
          break;
        }
      }

      if (facultyHasConflict) {
        continue;
      }

      // 4. Theory consecutive rule: must not create >= 3 consecutive periods of same course
      if (wouldCreateThreeConsecutiveTheory(day, period, variable.courseCode, classOccupancy, periods)) {
        continue;
      }

      // 5. Theory session rule: must not fill an entire morning or afternoon session
      if (wouldFillEntireSession(day, period, variable.courseCode, classOccupancy, periods)) {
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
        courseName: variable.courseName,
        facultyId: variable.facultyId,
        facultyName: variable.facultyName,
        facultyAssignments: variable.facultyAssignments,
        room: variable.room,
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

const {
  isFacultyAvailable,
  isClassPeriodAvailable,
  isTheoryPlacementValid,
  isLabPlacementValid,
} = require('./timetableCoreLogic');

module.exports = {
  generateLabCandidates,
  generateTheoryCandidates,
  generateCandidatesForVariable,
  wouldCreateThreeConsecutiveTheory,
  wouldFillEntireSession,
  getCourseCountOnDay,
  isFacultyAvailable,
  isClassPeriodAvailable,
  isTheoryPlacementValid,
  isLabPlacementValid,
};
