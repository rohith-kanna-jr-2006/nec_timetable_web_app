/**
 * Automated Timetable Constraint Satisfaction & Optimization Problem (CSOP/CSP) Solver
 *
 * Implements:
 * - Laboratory-first allocation
 * - Dynamic MRV (Minimum Remaining Values)
 * - Forward checking with early dead-end pruning
 * - Backtracking search with disciplined state restoration
 * - Least-Constraining Value (LCV) heuristic
 * - Soft-constraint optimization scoring
 * - Deterministic seeded pseudo-random tie-breaking (Mulberry32)
 * - Independent 14-point hard validation pass
 * - Bounded search safety controls (max nodes, max backtracks, timeout)
 */

const SeededRandom = require('./seededRandom');
const { forwardCheckAndOrderMRV } = require('./forwardChecker');
const { rankCandidates } = require('./candidateScorer');
const { validateGeneratedSchedule } = require('./timetableValidator');

class SearchLimitError extends Error {
  constructor(message, code = 'SEARCH_LIMIT_REACHED', details = {}) {
    super(message);
    this.name = 'SearchLimitError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Solves the timetable CSP given problem context and solver configuration.
 *
 * @param {Object} problemSpec - Output from buildSchedulingContext
 * @param {Object} options - Configuration overrides (seed, maxNodes, maxBacktracks, timeoutMs)
 * @returns {Object} Solution result or structured failure diagnostics
 */
async function solveTimetable(problemSpec, options = {}) {
  const startTime = Date.now();

  const {
    context,
    version,
    allVariables,
    labVariables,
    theoryVariables,
    resolvedRequirements,
    globalFacultyOccupancy: initialGlobalFacultyOccupancy,
    existingClassOccupancy: initialClassOccupancy,
    facultyUnavailableSet,
    gridConfig,
  } = problemSpec;

  // Initialize deterministic seeded RNG
  const generationSeed = options.generationSeed || SeededRandom.hashSeed(options.seed || Date.now());
  const rng = new SeededRandom(generationSeed);

  // Safety search bounds
  const maxNodes = options.maxNodes || 5000;
  const maxBacktracks = options.maxBacktracks || 1200;
  const timeoutMs = options.timeoutMs || 10000;

  // Map of authoritative HOD allocations for fast lookup
  const hodAllocationsMap = new Map();
  resolvedRequirements.forEach((r) => {
    hodAllocationsMap.set(r.courseCode, {
      facultyId: r.facultyId,
      facultyName: r.facultyName,
      allocationType: r.isLab ? 'LAB_PRIMARY' : 'THEORY',
    });
  });

  // Solver Context
  const solverContext = {
    gridConfig,
    totalLabsCount: labVariables.length,
    rng,
    hodAllocationsMap,
  };

  // Mutable Solver State (disciplined for backtracking)
  const classOccupancy = new Map(initialClassOccupancy);
  const globalFacultyOccupancy = new Map(initialGlobalFacultyOccupancy);
  const scheduledLabs = [];
  const assignments = new Map();

  const state = {
    classOccupancy,
    globalFacultyOccupancy,
    facultyUnavailableSet,
    scheduledLabs,
    assignments,
    remainingVariables: [...allVariables],
  };

  const metrics = {
    generationSeed,
    variablesCount: allVariables.length,
    labBlocksCount: labVariables.length,
    theoryPeriodsCount: theoryVariables.length,
    nodesExplored: 0,
    backtracks: 0,
    forwardCheckFailures: 0,
    durationMs: 0,
  };

  let bestSolution = null;

  function convertAssignmentsToSessions(assignmentMap) {
    const sessions = [];
    for (const [varId, cand] of assignmentMap.entries()) {
      const facultyList =
        Array.isArray(cand.facultyAssignments) && cand.facultyAssignments.length > 0
          ? cand.facultyAssignments
          : [
              {
                facultyId: cand.facultyId,
                facultyName: cand.facultyName || '',
                role: cand.isLab ? 'PRIMARY' : 'THEORY',
              },
            ];

      for (const p of cand.periods) {
        sessions.push({
          timetableVersionId: version ? version._id : null,
          academicContextId: context ? context._id : null,
          courseCode: cand.courseCode,
          courseName: cand.courseName || '',
          facultyId: cand.facultyId || facultyList[0]?.facultyId,
          facultyName: cand.facultyName || facultyList[0]?.facultyName || '',
          facultyAssignments: facultyList,
          day: cand.day,
          period: p,
          room: cand.room || (cand.isLab ? 'Systems Lab' : 'LH-101'),
          sessionType: cand.isLab ? 'LAB' : (cand.sessionType || 'THEORY'),
          duration: cand.duration || 1,
        });
      }
    }
    return sessions;
  }

  // Recursive CSP Backtracking Search with MRV & Forward Checking
  function backtrackSearch(remainingVars) {
    // Check timeout and node limits
    metrics.nodesExplored++;
    if (metrics.nodesExplored > maxNodes) {
      throw new SearchLimitError(
        `Search node limit (${maxNodes}) exceeded without finding a solution.`,
        'SEARCH_LIMIT_REACHED',
        { nodesExplored: metrics.nodesExplored }
      );
    }
    if (metrics.backtracks > maxBacktracks) {
      throw new SearchLimitError(
        `Maximum backtracks limit (${maxBacktracks}) exceeded without finding a solution.`,
        'SEARCH_LIMIT_REACHED',
        { backtracks: metrics.backtracks }
      );
    }
    if (Date.now() - startTime > timeoutMs) {
      throw new SearchLimitError(
        `Solver timeout (${timeoutMs}ms) reached without finding a solution.`,
        'SEARCH_LIMIT_REACHED',
        { timeoutMs }
      );
    }

    // Base Case: All variables assigned
    if (remainingVars.length === 0) {
      const candidateSessions = convertAssignmentsToSessions(assignments);

      // Independent 14-point hard validation pass
      const validation = validateGeneratedSchedule(candidateSessions, {
        context,
        resolvedRequirements,
        hodAllocationsMap,
        gridConfig,
        existingGlobalOccupancy: initialGlobalFacultyOccupancy,
      });

      if (validation.isValid) {
        bestSolution = candidateSessions;
        return true;
      }
      return false;
    }

    // Forward Checking & Dynamic MRV Variable Ordering
    state.remainingVariables = remainingVars;
    const forwardCheckResult = forwardCheckAndOrderMRV(remainingVars, state, solverContext);

    if (!forwardCheckResult.feasible) {
      metrics.forwardCheckFailures++;
      return false; // Prune branch early!
    }

    const { orderedVariables, candidateMap } = forwardCheckResult;
    const currentVar = orderedVariables[0];
    const rawCandidates = candidateMap.get(currentVar.id) || [];

    if (rawCandidates.length === 0) {
      metrics.forwardCheckFailures++;
      return false;
    }

    // Rank candidates using Soft Heuristics + Least-Constraining Value (LCV) + Seeded Jitter
    const rankedCandidates = rankCandidates(rawCandidates, currentVar, state, solverContext);

    const facultyList =
      Array.isArray(currentVar.facultyAssignments) && currentVar.facultyAssignments.length > 0
        ? currentVar.facultyAssignments
        : [{ facultyId: currentVar.facultyId }];

    // Try candidates in order of score
    for (const cand of rankedCandidates) {
      // 1. Commit Assignment to State
      for (const p of cand.periods) {
        classOccupancy.set(`${cand.day}_${p}`, {
          courseCode: currentVar.courseCode,
          facultyId: currentVar.facultyId,
          sessionType: currentVar.isLab ? 'LAB' : 'THEORY',
          variableId: currentVar.id,
        });

        for (const fa of facultyList) {
          globalFacultyOccupancy.set(`${fa.facultyId}_${cand.day}_${p}`, {
            academicContextId: context ? context._id : null,
            courseCode: currentVar.courseCode,
            sessionType: currentVar.isLab ? 'LAB' : 'THEORY',
          });
        }
      }

      if (currentVar.isLab) {
        scheduledLabs.push({
          courseCode: currentVar.courseCode,
          day: cand.day,
          periods: cand.periods,
          session: cand.session,
        });
      }

      assignments.set(currentVar.id, {
        ...currentVar,
        ...cand,
      });

      const nextRemaining = remainingVars.filter((v) => v.id !== currentVar.id);

      // 2. Recursive descent
      const success = backtrackSearch(nextRemaining);
      if (success) {
        return true;
      }

      // 3. Backtrack: Undo state mutation cleanly
      metrics.backtracks++;
      assignments.delete(currentVar.id);

      if (currentVar.isLab) {
        scheduledLabs.pop();
      }

      for (const p of cand.periods) {
        classOccupancy.delete(`${cand.day}_${p}`);
        for (const fa of facultyList) {
          globalFacultyOccupancy.delete(`${fa.facultyId}_${cand.day}_${p}`);
        }
      }
    }

    return false;
  }

  try {
    const solved = backtrackSearch(allVariables);
    metrics.durationMs = Date.now() - startTime;

    if (solved && bestSolution) {
      return {
        success: true,
        generationSeed,
        timetableVersion: version,
        academicContext: context,
        sessionsCount: bestSolution.length,
        sessions: bestSolution,
        metrics,
        diagnostics: {
          status: 'SUCCESS',
          message: 'Complete timetable generated satisfying all hard constraints and soft heuristics.',
        },
      };
    }

    return {
      success: false,
      code: 'UNSATISFIABLE_CONSTRAINTS',
      message: 'Constraints are unsatisfiable. No valid complete timetable exists for this configuration.',
      metrics,
      diagnostics: {
        status: 'FAILED',
        reason: 'Search tree exhausted without locating a conflict-free schedule.',
      },
    };
  } catch (err) {
    metrics.durationMs = Date.now() - startTime;
    if (err instanceof SearchLimitError) {
      return {
        success: false,
        code: err.code,
        message: err.message,
        metrics,
        diagnostics: {
          status: 'LIMIT_EXCEEDED',
          details: err.details,
        },
      };
    }
    throw err;
  }
}

const {
  isFacultyAvailable,
  isClassPeriodAvailable,
  isTheoryPlacementValid,
  isLabPlacementValid,
  wouldFillEntireSession,
  generateLabSchedule,
  generateTheorySchedule,
  validateTimetable,
  generateFacultyTimetable,
  generateClassTimetable,
} = require('./timetableCoreLogic');

module.exports = {
  solveTimetable,
  isFacultyAvailable,
  isClassPeriodAvailable,
  isTheoryPlacementValid,
  isLabPlacementValid,
  wouldFillEntireSession,
  generateLabSchedule,
  generateTheorySchedule,
  validateTimetable,
  generateFacultyTimetable,
  generateClassTimetable,
};
