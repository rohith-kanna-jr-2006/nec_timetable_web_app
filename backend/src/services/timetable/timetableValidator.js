/**
 * Independent Final Hard-Constraint Validator
 *
 * Runs AFTER the solver completes in-memory.
 * Validates the solution independently from the solver's internal search state.
 * Any constraint failure causes the solution to be rejected.
 */

const { arePeriodsConsecutive, crossesBreak, isAfternoonBlock } = require('./timetableGrid');

/**
 * Validates a generated assignment dataset against all 14 mandatory institutional hard constraints.
 *
 * @param {Array} assignments - Array of generated session assignments
 * @param {Object} problemSpec - Authoritative problem definition (context, requiredCounts, hodAllocations, etc.)
 * @returns {Object} { isValid: boolean, errors: Array, diagnostics: Object }
 */
function validateGeneratedSchedule(assignments, problemSpec) {
  const errors = [];
  const {
    context,
    resolvedRequirements,
    hodAllocationsMap,
    gridConfig,
    existingGlobalOccupancy = new Map(),
    existingLockedSessions = [],
  } = problemSpec;

  const { days, periods } = gridConfig;

  // 1. Check: Every required course period count is present
  const courseCountMap = new Map();
  assignments.forEach((s) => {
    courseCountMap.set(s.courseCode, (courseCountMap.get(s.courseCode) || 0) + 1);
  });

  for (const req of resolvedRequirements) {
    const allocated = courseCountMap.get(req.courseCode) || 0;
    if (allocated !== req.totalPeriod) {
      errors.push({
        code: 'PERIOD_COUNT_MISMATCH',
        courseCode: req.courseCode,
        message: `Course '${req.courseCode}' requires ${req.totalPeriod} periods, but ${allocated} were allocated.`,
      });
    }
  }

  // 2. Check: Class double-booking conflicts & exact duplicate session prevention
  const classOccupancy = new Map();
  for (const session of assignments) {
    const slotKey = `${session.day}_${session.period}`;
    if (classOccupancy.has(slotKey)) {
      const existing = classOccupancy.get(slotKey);
      if (existing.courseCode === session.courseCode && existing.facultyId === session.facultyId) {
        errors.push({
          code: 'DUPLICATE_SESSION',
          session,
          message: `Exact duplicate session for course '${session.courseCode}' on ${session.day} ${session.period}.`,
        });
      } else {
        errors.push({
          code: 'CLASS_TIME_CONFLICT',
          session,
          existing,
          message: `Class conflict on ${session.day} ${session.period} between '${existing.courseCode}' and '${session.courseCode}'.`,
        });
      }
    } else {
      classOccupancy.set(slotKey, session);
    }
  }

  // 3. Check: Global faculty conflicts (across this class AND other classes)
  const facultyOccupancy = new Map();
  for (const session of assignments) {
    const facSlotKey = `${session.facultyId}_${session.day}_${session.period}`;

    // Conflict within this class schedule
    if (facultyOccupancy.has(facSlotKey)) {
      errors.push({
        code: 'FACULTY_TIME_CONFLICT',
        session,
        message: `Faculty '${session.facultyId}' is double-booked on ${session.day} ${session.period} in this timetable.`,
      });
    } else {
      facultyOccupancy.set(facSlotKey, session);
    }

    // Conflict with external class schedules
    if (existingGlobalOccupancy.has(facSlotKey)) {
      const ext = existingGlobalOccupancy.get(facSlotKey);
      errors.push({
        code: 'GLOBAL_FACULTY_CONFLICT',
        session,
        externalConflict: ext,
        message: `Faculty '${session.facultyId}' is already scheduled in an external cohort on ${session.day} ${session.period}.`,
      });
    }
  }

  // 4. Check: All lab blocks are continuous and do not cross breaks
  const labSessionsByCourseDay = new Map();
  assignments.filter((s) => s.sessionType === 'LAB').forEach((s) => {
    const key = `${s.courseCode}_${s.day}`;
    if (!labSessionsByCourseDay.has(key)) {
      labSessionsByCourseDay.set(key, []);
    }
    labSessionsByCourseDay.get(key).push(s);
  });

  const distinctLabBlocks = [];

  for (const [key, labSessions] of labSessionsByCourseDay.entries()) {
    // Sort by period order
    labSessions.sort((a, b) => periods.indexOf(a.period) - periods.indexOf(b.period));
    const blockPeriods = labSessions.map((s) => s.period);

    // Continuity check
    if (!arePeriodsConsecutive(blockPeriods, periods)) {
      errors.push({
        code: 'LAB_NOT_CONSECUTIVE',
        key,
        periods: blockPeriods,
        message: `Laboratory block for '${key}' is non-continuous (${blockPeriods.join(', ')}).`,
      });
    }

    // Break crossing check
    if (crossesBreak(blockPeriods)) {
      errors.push({
        code: 'LAB_CROSSES_BREAK',
        key,
        periods: blockPeriods,
        message: `Laboratory block for '${key}' crosses a major interval/lunch break (${blockPeriods.join(', ')}).`,
      });
    }

    distinctLabBlocks.push({
      courseCode: labSessions[0].courseCode,
      day: labSessions[0].day,
      periods: blockPeriods,
      isAfternoon: isAfternoonBlock(blockPeriods),
    });
  }

  // 5. Check: Multi-lab afternoon rule
  // If numberOfLabs > 1, AT LEAST ONE laboratory block MUST be placed in an afternoon session.
  const totalLabRequirements = resolvedRequirements.filter((r) => r.isLab);
  if (totalLabRequirements.length > 1) {
    const hasAfternoonLab = distinctLabBlocks.some((b) => b.isAfternoon);
    if (!hasAfternoonLab) {
      errors.push({
        code: 'MULTI_LAB_AFTERNOON_REQUIRED',
        message: `Timetable has ${totalLabRequirements.length} laboratories, but zero laboratory blocks are scheduled in an afternoon session.`,
      });
    }
  }

  // 6. Check: Theory consecutive rule (MUST NOT create 3 or more consecutive periods)
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
          message: `Theory subject '${s1.courseCode}' violates the consecutive rule with 3 continuous periods on ${day} (${periods[i]}, ${periods[i + 1]}, ${periods[i + 2]}).`,
        });
      }
    }
  }

  // 7. Check: Valid timetable slots
  for (const s of assignments) {
    if (!days.includes(s.day)) {
      errors.push({
        code: 'INVALID_DAY',
        session: s,
        message: `Day '${s.day}' is not a valid working day.`,
      });
    }
    if (!periods.includes(s.period)) {
      errors.push({
        code: 'INVALID_PERIOD',
        session: s,
        message: `Period '${s.period}' is not a valid working period.`,
      });
    }
  }

  // 8. Check: Correct HOD Faculty
  if (hodAllocationsMap) {
    for (const s of assignments) {
      const alloc = hodAllocationsMap.get(s.courseCode);
      if (!alloc) {
        errors.push({
          code: 'HOD_ALLOCATION_REQUIRED',
          courseCode: s.courseCode,
          message: `Session for '${s.courseCode}' has no registered HOD allocation.`,
        });
      } else if (alloc.facultyId !== s.facultyId) {
        errors.push({
          code: 'HOD_FACULTY_MISMATCH',
          courseCode: s.courseCode,
          assignedFaculty: s.facultyId,
          expectedFaculty: alloc.facultyId,
          message: `Session faculty '${s.facultyId}' does not match HOD authoritative faculty '${alloc.facultyId}' for '${s.courseCode}'.`,
        });
      }
    }
  }

  // 9. Check: Existing locked sessions not violated
  for (const locked of existingLockedSessions) {
    const current = classOccupancy.get(`${locked.day}_${locked.period}`);
    if (!current || current.courseCode !== locked.courseCode) {
      errors.push({
        code: 'LOCKED_SESSION_OVERWRITTEN',
        lockedSession: locked,
        message: `Existing locked session on ${locked.day} ${locked.period} (${locked.courseCode}) was corrupted or overwritten.`,
      });
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    diagnostics: {
      totalAssigned: assignments.length,
      distinctLabBlocksCount: distinctLabBlocks.length,
      errorCount: errors.length,
    },
  };
}

module.exports = {
  validateGeneratedSchedule,
};
