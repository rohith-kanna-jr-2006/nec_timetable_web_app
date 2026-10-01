/**
 * Academic Timetable Core Constraint Logic & Solver Engine
 *
 * Implements authoritative institutional scheduling functions:
 * - isFacultyAvailable()
 * - isClassPeriodAvailable()
 * - isTheoryPlacementValid()
 * - isLabPlacementValid()
 * - wouldFillEntireSession()
 * - generateLabSchedule()
 * - generateTheorySchedule()
 * - validateTimetable()
 * - generateFacultyTimetable()
 * - generateClassTimetable()
 *
 * Single source of truth for both Class Timetable and Faculty Timetable views.
 */

const {
  DEFAULT_DAYS,
  DEFAULT_PERIODS,
  MORNING_PERIODS,
  AFTERNOON_PERIODS,
  arePeriodsConsecutive,
  crossesBreak,
  isMorningBlock,
  isAfternoonBlock,
  getValidLabBlocksForDay,
} = require('./timetableGrid');
const { rankCandidates } = require('./candidateScorer');
const SeededRandom = require('./seededRandom');

/**
 * Checks if placing a theory course at day + period causes >= 3 consecutive periods of that course.
 */
function wouldCreateThreeConsecutiveTheory(day, period, courseCode, classOccupancy, allPeriods = DEFAULT_PERIODS) {
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
 * Counts how many periods of courseCode are already scheduled on this day
 */
function getCourseCountOnDay(day, courseCode, classOccupancy, allPeriods = DEFAULT_PERIODS) {
  let count = 0;
  for (const p of allPeriods) {
    const session = classOccupancy instanceof Map ? classOccupancy.get(`${day}_${p}`) : classOccupancy?.[`${day}_${p}`];
    if (session && session.courseCode === courseCode) {
      count++;
    }
  }
  return count;
}

/**
 * 1. Checks if a faculty member (or multiple faculty) is available on day + period(s).
 *
 * @param {string|Array<string>} facultyId - Faculty ID or array of faculty IDs
 * @param {string} day - 'MON'..'FRI'
 * @param {string|Array<string>} period - 'P1'..'P8' or array of periods
 * @param {Map|Object} globalFacultyOccupancy - Map of `${fid}_${day}_${period}` -> session
 * @param {Set|Array} facultyUnavailableSet - Set of `${fid}_${day}_${period}`
 * @returns {boolean} true if available for all periods and all faculty, false if conflict
 */
function isFacultyAvailable(
  facultyId,
  day,
  period,
  globalFacultyOccupancy = new Map(),
  facultyUnavailableSet = new Set()
) {
  if (!facultyId || !day || !period) return false;

  const fids = (Array.isArray(facultyId) ? facultyId : [facultyId])
    .map((f) => (typeof f === 'object' && f ? f.facultyId : f))
    .filter(Boolean);

  const periodsToCheck = Array.isArray(period) ? period : [period];

  for (const fid of fids) {
    for (const p of periodsToCheck) {
      const slotKey = `${fid}_${day}_${p}`;

      // Check global faculty occupancy (scheduled in this class or another class)
      if (globalFacultyOccupancy instanceof Map) {
        if (globalFacultyOccupancy.has(slotKey)) return false;
      } else if (globalFacultyOccupancy && globalFacultyOccupancy[slotKey]) {
        return false;
      }

      // Check faculty personal unavailability
      if (facultyUnavailableSet instanceof Set) {
        if (facultyUnavailableSet.has(slotKey)) return false;
      } else if (Array.isArray(facultyUnavailableSet)) {
        if (facultyUnavailableSet.includes(slotKey)) return false;
      }
    }
  }

  return true;
}

/**
 * 2. Checks if class slot(s) is free (no other subject scheduled at day + period(s)).
 *
 * @param {string} day - 'MON'..'FRI'
 * @param {string|Array<string>} period - 'P1'..'P8' or array of periods
 * @param {Map|Object} classOccupancy - Map of `${day}_${period}` -> session
 * @returns {boolean} true if free, false if occupied
 */
function isClassPeriodAvailable(day, period, classOccupancy = new Map()) {
  if (!day || !period) return false;
  const periodsToCheck = Array.isArray(period) ? period : [period];

  for (const p of periodsToCheck) {
    const slotKey = `${day}_${p}`;
    if (classOccupancy instanceof Map) {
      if (classOccupancy.has(slotKey)) return false;
    } else if (classOccupancy && classOccupancy[slotKey]) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether placing courseCode at period on day would fill an entire session (morning or afternoon).
 * Requirement 1: Never fill an entire morning, afternoon, or evening/session with the same theory subject.
 *
 * @param {string} day - 'MON'..'FRI'
 * @param {string} period - 'P1'..'P8'
 * @param {string} courseCode - e.g. '22CSC14'
 * @param {Map} classOccupancy - Map of `${day}_${period}` -> session
 * @param {Array<string>} allPeriods - Full periods list
 * @returns {boolean} true if it would fill an entire session, false otherwise
 */
function wouldFillEntireSession(day, period, courseCode, classOccupancy, allPeriods = DEFAULT_PERIODS) {
  const morningList = allPeriods.filter((p) => MORNING_PERIODS.includes(p));
  const afternoonList = allPeriods.filter((p) => AFTERNOON_PERIODS.includes(p));

  const isMorning = morningList.includes(period);
  const targetSessionPeriods = isMorning ? morningList : afternoonList;

  if (targetSessionPeriods.length === 0) return false;

  let courseCountInSession = 0;
  for (const p of targetSessionPeriods) {
    if (p === period) {
      courseCountInSession++;
    } else {
      const session = classOccupancy instanceof Map ? classOccupancy.get(`${day}_${p}`) : classOccupancy?.[`${day}_${p}`];
      if (session && session.courseCode === courseCode) {
        courseCountInSession++;
      }
    }
  }

  return courseCountInSession >= targetSessionPeriods.length;
}

/**
 * 3. Validates whether placing a THEORY subject at day + period is valid against all constraints:
 * - Class period is free
 * - Faculty is available (across this class and external classes)
 * - Never 3+ consecutive periods of the same theory subject
 * - Never fills an entire morning or afternoon session
 * - Distributes across weekdays (max 2 periods of the same theory course per day)
 */
function isTheoryPlacementValid(
  day,
  period,
  courseCode,
  facultyId,
  classOccupancy = new Map(),
  globalFacultyOccupancy = new Map(),
  facultyUnavailableSet = new Set(),
  gridConfig = {},
  options = {}
) {
  const periods = gridConfig.periods || DEFAULT_PERIODS;

  // 1. Class slot must be available
  if (!isClassPeriodAvailable(day, period, classOccupancy)) {
    return false;
  }

  // 2. Faculty must be available (no conflict with another class or unavailability)
  if (!isFacultyAvailable(facultyId, day, period, globalFacultyOccupancy, facultyUnavailableSet)) {
    return false;
  }

  // 3. Never schedule the same theory subject for 3+ consecutive periods
  if (wouldCreateThreeConsecutiveTheory(day, period, courseCode, classOccupancy, periods)) {
    return false;
  }

  // 4. Never fill an entire morning or afternoon session with the same theory subject
  if (wouldFillEntireSession(day, period, courseCode, classOccupancy, periods)) {
    return false;
  }

  // 5. Daily course distribution constraint: at most 2 periods of same theory course per day
  const maxPerDay = options.maxPerDay !== undefined ? options.maxPerDay : 2;
  const currentCount = getCourseCountOnDay(day, courseCode, classOccupancy, periods);
  if (currentCount >= maxPerDay) {
    return false;
  }

  return true;
}

/**
 * 4. Validates whether placing a LABORATORY block (periods array) is valid:
 * - Exactly 4 continuous periods
 * - Does not cross lunch break
 * - All 4 periods available for class
 * - Faculty available for ALL 4 lab periods (no conflict in any class)
 * - Multi-lab rule: if multiple labs, at least one must be afternoon
 */
function isLabPlacementValid(
  day,
  periods,
  courseCode,
  facultyIds,
  classOccupancy = new Map(),
  globalFacultyOccupancy = new Map(),
  facultyUnavailableSet = new Set(),
  gridConfig = {},
  options = {}
) {
  const allPeriods = gridConfig.periods || DEFAULT_PERIODS;

  // 1. Must occupy exactly 4 periods
  if (!Array.isArray(periods) || periods.length !== 4) {
    return false;
  }

  // 2. Must be strictly consecutive
  if (!arePeriodsConsecutive(periods, allPeriods)) {
    return false;
  }

  // 3. Must not cross lunch break
  if (crossesBreak(periods)) {
    return false;
  }

  // 4. Must be strictly morning or strictly afternoon
  const isMorning = isMorningBlock(periods);
  const isAfternoon = isAfternoonBlock(periods);
  if (!isMorning && !isAfternoon) {
    return false;
  }

  // 5. Multi-lab rule check
  const totalLabs = options.totalLabsCount || 1;
  const scheduledLabs = options.scheduledLabs || [];
  if (totalLabs > 1) {
    const afternoonCount = scheduledLabs.filter((l) => l.session === 'AFTERNOON').length;
    const remainingLabs = totalLabs - scheduledLabs.length;
    // If this is the last lab to schedule and none are afternoon yet, this MUST be afternoon!
    if (afternoonCount === 0 && remainingLabs === 1 && !isAfternoon) {
      return false;
    }
  }

  // 6. Class availability for ALL 4 periods
  if (!isClassPeriodAvailable(day, periods, classOccupancy)) {
    return false;
  }

  // 7. Faculty availability for ALL 4 periods (checks every assigned faculty)
  if (!isFacultyAvailable(facultyIds, day, periods, globalFacultyOccupancy, facultyUnavailableSet)) {
    return false;
  }

  return true;
}

/**
 * 5. Generates the Laboratory Schedule FIRST using constraint-based scheduling.
 *
 * @param {Array} labVariables - Array of lab variable objects
 * @param {Object} state - Solver state
 * @param {Object} context - Problem context
 * @returns {boolean} true if all labs placed successfully, false if backtracking needed
 */
function generateLabSchedule(labVariables, state, context) {
  if (!labVariables || labVariables.length === 0) {
    return true; // No labs to schedule
  }

  const { gridConfig, totalLabsCount, rng } = context;
  const { days, periods } = gridConfig;
  const { classOccupancy, globalFacultyOccupancy, facultyUnavailableSet, scheduledLabs, assignments } = state;

  function solveLabIndex(idx) {
    if (idx >= labVariables.length) {
      return true; // All labs placed!
    }

    const currentLab = labVariables[idx];
    const facultyList =
      Array.isArray(currentLab.facultyAssignments) && currentLab.facultyAssignments.length > 0
        ? currentLab.facultyAssignments.map((f) => f.facultyId)
        : [currentLab.facultyId].filter(Boolean);

    // Find all valid 4-period candidate blocks across days
    const candidates = [];
    for (const day of days) {
      const validBlocks = getValidLabBlocksForDay(day, currentLab.duration || 4, periods);

      for (const block of validBlocks) {
        if (
          isLabPlacementValid(
            day,
            block.periods,
            currentLab.courseCode,
            facultyList,
            classOccupancy,
            globalFacultyOccupancy,
            facultyUnavailableSet,
            gridConfig,
            { totalLabsCount, scheduledLabs }
          )
        ) {
          candidates.push({
            day,
            periods: block.periods,
            session: block.session,
            duration: 4,
            isLab: true,
            courseCode: currentLab.courseCode,
            courseName: currentLab.courseName,
            facultyId: currentLab.facultyId,
            facultyName: currentLab.facultyName,
            facultyAssignments: currentLab.facultyAssignments,
            room: currentLab.room || 'Systems Lab',
          });
        }
      }
    }

    if (candidates.length === 0) {
      return false; // Dead-end!
    }

    // Score and rank candidates:
    // If single lab: morning preferred (+100)
    // If multiple labs: afternoon prioritized if none yet (+120)
    const afternoonCount = scheduledLabs.filter((l) => l.session === 'AFTERNOON').length;
    const scoredCandidates = candidates.map((cand) => {
      let score = 0;
      if (totalLabsCount === 1) {
        if (cand.session === 'MORNING') score += 100;
        else score += 10;
      } else {
        if (afternoonCount === 0 && cand.session === 'AFTERNOON') score += 120;
        else if (afternoonCount > 0 && cand.session === 'MORNING') score += 80;
        else score += 50;
      }
      // Add seeded random jitter for variety among valid slots
      if (rng) {
        score += rng.next() * 15;
      }
      return { candidate: cand, score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    for (const { candidate } of scoredCandidates) {
      // Commit
      for (const p of candidate.periods) {
        classOccupancy.set(`${candidate.day}_${p}`, {
          courseCode: currentLab.courseCode,
          facultyId: currentLab.facultyId,
          sessionType: 'LAB',
          variableId: currentLab.id,
        });

        for (const fid of facultyList) {
          globalFacultyOccupancy.set(`${fid}_${candidate.day}_${p}`, {
            courseCode: currentLab.courseCode,
            sessionType: 'LAB',
          });
        }
      }

      scheduledLabs.push({
        courseCode: currentLab.courseCode,
        day: candidate.day,
        periods: candidate.periods,
        session: candidate.session,
      });

      assignments.set(currentLab.id, {
        ...currentLab,
        ...candidate,
      });

      // Recurse
      if (solveLabIndex(idx + 1)) {
        return true;
      }

      // Backtrack
      for (const p of candidate.periods) {
        classOccupancy.delete(`${candidate.day}_${p}`);
        for (const fid of facultyList) {
          globalFacultyOccupancy.delete(`${fid}_${candidate.day}_${p}`);
        }
      }
      scheduledLabs.pop();
      assignments.delete(currentLab.id);
    }

    return false;
  }

  return solveLabIndex(0);
}

/**
 * 6. Generates the Theory Schedule SECOND into remaining slots with constraint-based randomization.
 *
 * @param {Array} theoryVariables - Array of single-period theory variable objects
 * @param {Object} state - Solver state
 * @param {Object} context - Problem context
 * @returns {boolean} true if all theory periods placed successfully, false if backtracking needed
 */
function generateTheorySchedule(theoryVariables, state, context) {
  if (!theoryVariables || theoryVariables.length === 0) {
    return true; // No theory variables to schedule
  }

  const { gridConfig, rng } = context;
  const { days, periods } = gridConfig;
  const { classOccupancy, globalFacultyOccupancy, facultyUnavailableSet, assignments } = state;

  function solveTheoryVariables(remainingVars) {
    if (remainingVars.length === 0) {
      return true; // All theory periods placed!
    }

    // Dynamic MRV: find variable with fewest valid candidate slots
    let bestVar = null;
    let minCandidates = null;
    let bestVarCandidates = null;

    for (const v of remainingVars) {
      const candidates = [];
      const facultyList =
        Array.isArray(v.facultyAssignments) && v.facultyAssignments.length > 0
          ? v.facultyAssignments.map((f) => f.facultyId)
          : [v.facultyId].filter(Boolean);

      for (const day of days) {
        for (const period of periods) {
          if (
            isTheoryPlacementValid(
              day,
              period,
              v.courseCode,
              facultyList,
              classOccupancy,
              globalFacultyOccupancy,
              facultyUnavailableSet,
              gridConfig
            )
          ) {
            candidates.push({
              day,
              period,
              periods: [period],
              session: isMorningBlock([period]) ? 'MORNING' : 'AFTERNOON',
              duration: 1,
              isLab: false,
              courseCode: v.courseCode,
              courseName: v.courseName,
              facultyId: v.facultyId,
              facultyName: v.facultyName,
              facultyAssignments: v.facultyAssignments,
              room: v.room || 'LH-101',
            });
          }
        }
      }

      if (candidates.length === 0) {
        return false; // Domain wipeout! Backtrack early.
      }

      if (minCandidates === null || candidates.length < minCandidates) {
        minCandidates = candidates.length;
        bestVar = v;
        bestVarCandidates = candidates;
      }
    }

    // Rank candidate slots using soft constraints + controlled seeded jitter
    const ranked = rankCandidates(bestVarCandidates, bestVar, state, context);

    const currentFacultyList =
      Array.isArray(bestVar.facultyAssignments) && bestVar.facultyAssignments.length > 0
        ? bestVar.facultyAssignments.map((f) => f.facultyId)
        : [bestVar.facultyId].filter(Boolean);

    for (const cand of ranked) {
      // Commit
      const slotKey = `${cand.day}_${cand.period}`;
      classOccupancy.set(slotKey, {
        day: cand.day,
        period: cand.period,
        courseCode: bestVar.courseCode,
        facultyId: bestVar.facultyId,
        sessionType: 'THEORY',
        variableId: bestVar.id,
      });

      for (const fid of currentFacultyList) {
        globalFacultyOccupancy.set(`${fid}_${cand.day}_${cand.period}`, {
          courseCode: bestVar.courseCode,
          sessionType: 'THEORY',
        });
      }

      assignments.set(bestVar.id, {
        ...bestVar,
        ...cand,
      });

      const nextRemaining = remainingVars.filter((v) => v.id !== bestVar.id);

      // Recurse
      if (solveTheoryVariables(nextRemaining)) {
        return true;
      }

      // Backtrack
      classOccupancy.delete(slotKey);
      for (const fid of currentFacultyList) {
        globalFacultyOccupancy.delete(`${fid}_${cand.day}_${cand.period}`);
      }
      assignments.delete(bestVar.id);
    }

    return false;
  }

  return solveTheoryVariables([...theoryVariables]);
}

/**
 * 7. Comprehensive Timetable Validation Pass.
 * Enforces all 8 core requirements.
 *
 * @param {Array} sessions - Array of scheduled session objects
 * @param {Object} options - Validation options and problem spec
 * @returns {Object} { isValid: boolean, errors: Array, diagnostics: Object }
 */
function validateTimetable(sessions, options = {}) {
  const errors = [];
  const {
    resolvedRequirements = [],
    hodAllocationsMap = null,
    gridConfig = {},
    existingGlobalOccupancy = new Map(),
  } = options;

  const days = gridConfig.days || DEFAULT_DAYS;
  const periods = gridConfig.periods || DEFAULT_PERIODS;

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      isValid: false,
      errors: [{ code: 'EMPTY_TIMETABLE', message: 'No timetable sessions to validate.' }],
      diagnostics: { totalSessions: 0 },
    };
  }

  // 1. Period Count Completeness
  const countByCourse = new Map();
  sessions.forEach((s) => {
    countByCourse.set(s.courseCode, (countByCourse.get(s.courseCode) || 0) + 1);
  });

  for (const req of resolvedRequirements) {
    const allocated = countByCourse.get(req.courseCode) || 0;
    if (allocated !== req.totalPeriod) {
      errors.push({
        code: 'PERIOD_COUNT_MISMATCH',
        courseCode: req.courseCode,
        message: `Course '${req.courseCode}' requires ${req.totalPeriod} periods, but ${allocated} were assigned.`,
      });
    }
  }

  // 2. Class conflict & unique period assignment (no class has two subjects in one period)
  const classOccupancy = new Map();
  for (const s of sessions) {
    const key = `${s.day}_${s.period}`;
    if (classOccupancy.has(key)) {
      const existing = classOccupancy.get(key);
      errors.push({
        code: 'CLASS_TIME_CONFLICT',
        day: s.day,
        period: s.period,
        courseCode: s.courseCode,
        conflictingCourseCode: existing.courseCode,
        message: `Class double-booked on ${s.day} ${s.period} between '${existing.courseCode}' and '${s.courseCode}'.`,
      });
    } else {
      classOccupancy.set(key, s);
    }
  }

  // 3. Faculty Conflict Check (critical: within timetable & against external classes)
  const facultyOccupancy = new Map();
  for (const s of sessions) {
    const fids = [s.facultyId, ...(s.facultyAssignments || []).map((a) => a.facultyId)].filter(Boolean);

    for (const fid of fids) {
      const facKey = `${fid}_${s.day}_${s.period}`;

      if (facultyOccupancy.has(facKey)) {
        errors.push({
          code: 'FACULTY_TIME_CONFLICT',
          facultyId: fid,
          day: s.day,
          period: s.period,
          courseCode: s.courseCode,
          message: `Faculty '${fid}' is double-booked on ${s.day} during ${s.period} within this timetable.`,
        });
      } else {
        facultyOccupancy.set(facKey, s);
      }

      if (existingGlobalOccupancy instanceof Map && existingGlobalOccupancy.has(facKey)) {
        errors.push({
          code: 'GLOBAL_FACULTY_CONFLICT',
          facultyId: fid,
          day: s.day,
          period: s.period,
          courseCode: s.courseCode,
          message: `Faculty '${fid}' is already assigned to another class on ${s.day} during ${s.period}.`,
        });
      }
    }
  }

  // 4. Theory 3+ Consecutive Rule
  for (const day of days) {
    for (let i = 0; i <= periods.length - 3; i++) {
      const s1 = classOccupancy.get(`${day}_${periods[i]}`);
      const s2 = classOccupancy.get(`${day}_${periods[i + 1]}`);
      const s3 = classOccupancy.get(`${day}_${periods[i + 2]}`);

      if (
        s1 &&
        s2 &&
        s3 &&
        s1.sessionType !== 'LAB' &&
        s2.sessionType !== 'LAB' &&
        s3.sessionType !== 'LAB' &&
        s1.courseCode === s2.courseCode &&
        s2.courseCode === s3.courseCode
      ) {
        errors.push({
          code: 'THEORY_CONSECUTIVE_VIOLATION',
          day,
          courseCode: s1.courseCode,
          periods: [periods[i], periods[i + 1], periods[i + 2]],
          message: `Theory subject '${s1.courseCode}' scheduled for 3+ consecutive periods on ${day} (${periods[i]}, ${periods[i + 1]}, ${periods[i + 2]}).`,
        });
      }
    }
  }

  // 5. Theory Fills Entire Session Rule
  const morningList = periods.filter((p) => MORNING_PERIODS.includes(p));
  const afternoonList = periods.filter((p) => AFTERNOON_PERIODS.includes(p));

  for (const day of days) {
    // Check morning
    if (morningList.length > 0) {
      const morningCourses = morningList
        .map((p) => classOccupancy.get(`${day}_${p}`))
        .filter((s) => s && s.sessionType !== 'LAB');

      if (morningCourses.length === morningList.length) {
        const firstCode = morningCourses[0].courseCode;
        if (morningCourses.every((s) => s.courseCode === firstCode)) {
          errors.push({
            code: 'THEORY_FILLS_ENTIRE_SESSION',
            day,
            session: 'MORNING',
            courseCode: firstCode,
            message: `Theory subject '${firstCode}' fills the entire morning session on ${day}.`,
          });
        }
      }
    }

    // Check afternoon
    if (afternoonList.length > 0) {
      const afternoonCourses = afternoonList
        .map((p) => classOccupancy.get(`${day}_${p}`))
        .filter((s) => s && s.sessionType !== 'LAB');

      if (afternoonCourses.length === afternoonList.length) {
        const firstCode = afternoonCourses[0].courseCode;
        if (afternoonCourses.every((s) => s.courseCode === firstCode)) {
          errors.push({
            code: 'THEORY_FILLS_ENTIRE_SESSION',
            day,
            session: 'AFTERNOON',
            courseCode: firstCode,
            message: `Theory subject '${firstCode}' fills the entire afternoon session on ${day}.`,
          });
        }
      }
    }
  }

  // 6. Laboratory 4-Period Continuity & Break Crossing
  const labSessionsByCourseDay = new Map();
  sessions.filter((s) => s.sessionType === 'LAB').forEach((s) => {
    const key = `${s.courseCode}_${s.day}`;
    if (!labSessionsByCourseDay.has(key)) labSessionsByCourseDay.set(key, []);
    labSessionsByCourseDay.get(key).push(s);
  });

  const distinctLabBlocks = [];
  for (const [key, labList] of labSessionsByCourseDay.entries()) {
    labList.sort((a, b) => periods.indexOf(a.period) - periods.indexOf(b.period));
    const blockPeriods = labList.map((s) => s.period);

    // Exactly 4 periods
    if (blockPeriods.length !== 4) {
      errors.push({
        code: 'LAB_NOT_FOUR_PERIODS',
        courseCode: labList[0].courseCode,
        day: labList[0].day,
        periods: blockPeriods,
        message: `Laboratory block for '${key}' must occupy exactly 4 continuous periods (found ${blockPeriods.length}).`,
      });
    }

    // Consecutive
    if (!arePeriodsConsecutive(blockPeriods, periods)) {
      errors.push({
        code: 'LAB_NOT_CONSECUTIVE',
        courseCode: labList[0].courseCode,
        day: labList[0].day,
        periods: blockPeriods,
        message: `Laboratory block for '${key}' is non-continuous (${blockPeriods.join(', ')}).`,
      });
    }

    // Break crossing
    if (crossesBreak(blockPeriods)) {
      errors.push({
        code: 'LAB_CROSSES_BREAK',
        courseCode: labList[0].courseCode,
        day: labList[0].day,
        periods: blockPeriods,
        message: `Laboratory block for '${key}' crosses major lunch interval (${blockPeriods.join(', ')}).`,
      });
    }

    distinctLabBlocks.push({
      courseCode: labList[0].courseCode,
      day: labList[0].day,
      periods: blockPeriods,
      isAfternoon: isAfternoonBlock(blockPeriods),
    });
  }

  // 7. Multi-lab Afternoon Rule: if labs > 1, at least one lab must be afternoon
  const labReqCount = resolvedRequirements.filter((r) => r.isLab).length || distinctLabBlocks.length;
  if (labReqCount > 1) {
    const hasAfternoon = distinctLabBlocks.some((b) => b.isAfternoon);
    if (!hasAfternoon) {
      errors.push({
        code: 'MULTI_LAB_AFTERNOON_REQUIRED',
        message: `Timetable has ${labReqCount} laboratories, but zero laboratory blocks are in the afternoon session.`,
      });
    }
  }

  const isValid = errors.length === 0;
  return {
    isValid,
    errors,
    diagnostics: {
      totalAssigned: sessions.length,
      distinctLabBlocksCount: distinctLabBlocks.length,
      errorCount: errors.length,
    },
  };
}

/**
 * 8. Generates Faculty Timetable View from the unified assignment dataset (Single Source of Truth).
 * Contains class, subject, subjectType, faculty, day, startPeriod, endPeriod.
 *
 * @param {Array} sessions - Complete timetable sessions
 * @param {string} facultyId - Faculty member ID
 * @returns {Array} List of personal timetable sessions
 */
function generateFacultyTimetable(sessions = [], facultyId) {
  if (!facultyId || !Array.isArray(sessions)) return [];

  const targetId = facultyId.trim();

  return sessions
    .filter((s) => {
      if (s.facultyId === targetId) return true;
      if (Array.isArray(s.facultyAssignments) && s.facultyAssignments.some((a) => a.facultyId === targetId)) {
        return true;
      }
      return false;
    })
    .map((s) => ({
      id: s._id || s.id,
      class: s.class || `${s.year || ''} ${s.department || ''} ${s.section || ''}`.trim() || 'Classroom',
      year: s.year || null,
      section: s.section || null,
      department: s.department || null,
      academicContextId: s.academicContextId || null,
      timetableVersionId: s.timetableVersionId || null,
      subject: s.courseName || s.courseCode,
      courseCode: s.courseCode,
      courseName: s.courseName || '',
      subjectType: s.sessionType || 'THEORY',
      sessionType: s.sessionType || 'THEORY',
      faculty: s.facultyName || s.facultyId,
      facultyId: s.facultyId,
      facultyAssignments: s.facultyAssignments || [],
      day: s.day,
      period: s.period,
      startPeriod: s.period,
      endPeriod: s.period,
      room: s.room || (s.sessionType === 'LAB' ? 'Systems Lab' : 'LH-101'),
      duration: s.duration || 1,
    }))
    .sort((a, b) => {
      const dayDiff = DEFAULT_DAYS.indexOf(a.day) - DEFAULT_DAYS.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return DEFAULT_PERIODS.indexOf(a.period) - DEFAULT_PERIODS.indexOf(b.period);
    });
}

/**
 * 9. Generates Class Timetable View from the unified assignment dataset (Single Source of Truth).
 *
 * @param {Array} sessions - Complete timetable sessions
 * @param {string} academicContextId - Academic cohort context ID
 * @returns {Array} List of class timetable sessions
 */
function generateClassTimetable(sessions = [], academicContextId = null) {
  if (!Array.isArray(sessions)) return [];

  const filtered = academicContextId
    ? sessions.filter((s) => !s.academicContextId || s.academicContextId.toString() === academicContextId.toString())
    : sessions;

  return filtered
    .map((s) => ({
      id: s._id || s.id,
      class: s.class || `${s.year || ''} ${s.department || ''} ${s.section || ''}`.trim() || 'Classroom',
      year: s.year || null,
      section: s.section || null,
      department: s.department || null,
      academicContextId: s.academicContextId || null,
      timetableVersionId: s.timetableVersionId || null,
      subject: s.courseName || s.courseCode,
      courseCode: s.courseCode,
      courseName: s.courseName || '',
      subjectType: s.sessionType || 'THEORY',
      sessionType: s.sessionType || 'THEORY',
      faculty: s.facultyName || s.facultyId,
      facultyId: s.facultyId,
      facultyAssignments: s.facultyAssignments || [],
      day: s.day,
      period: s.period,
      startPeriod: s.period,
      endPeriod: s.period,
      room: s.room || (s.sessionType === 'LAB' ? 'Systems Lab' : 'LH-101'),
      duration: s.duration || 1,
    }))
    .sort((a, b) => {
      const dayDiff = DEFAULT_DAYS.indexOf(a.day) - DEFAULT_DAYS.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return DEFAULT_PERIODS.indexOf(a.period) - DEFAULT_PERIODS.indexOf(b.period);
    });
}

module.exports = {
  isFacultyAvailable,
  isClassPeriodAvailable,
  wouldFillEntireSession,
  isTheoryPlacementValid,
  isLabPlacementValid,
  generateLabSchedule,
  generateTheorySchedule,
  validateTimetable,
  generateFacultyTimetable,
  generateClassTimetable,
};
