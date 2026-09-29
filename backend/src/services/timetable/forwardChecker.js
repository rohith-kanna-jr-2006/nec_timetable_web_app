/**
 * Forward Checking & Dynamic Minimum Remaining Values (MRV) Ordering
 *
 * Checks domain viability of all remaining unscheduled variables after every assignment.
 * Immediately flags zero-domain conditions to trigger backtracking before deep dead-ends.
 * Dynamically orders remaining variables using MRV (tightest domain first, labs first).
 */

const { generateCandidatesForVariable } = require('./candidateGenerator');

/**
 * Executes forward checking across all remaining variables and orders them dynamically.
 *
 * @param {Array} remainingVariables - Array of unscheduled variable objects
 * @param {Object} state - Current solver state (classOccupancy, globalFacultyOccupancy, etc.)
 * @param {Object} context - Problem context (gridConfig, totalLabsCount, rng, etc.)
 * @returns {Object} { feasible: boolean, orderedVariables: Array, candidateMap: Map, failureReason: Object|null }
 */
function forwardCheckAndOrderMRV(remainingVariables, state, context) {
  if (!remainingVariables || remainingVariables.length === 0) {
    return { feasible: true, orderedVariables: [], candidateMap: new Map() };
  }

  const candidateMap = new Map();

  for (const variable of remainingVariables) {
    const candidates = generateCandidatesForVariable(variable, state, context);

    // Forward check: if domain is empty, this branch is provably unsatisfiable
    if (candidates.length === 0) {
      return {
        feasible: false,
        emptyVariable: variable,
        candidateMap,
        failureReason: {
          code: variable.isLab ? 'NO_VALID_LAB_BLOCK' : 'NO_VALID_SLOT',
          courseCode: variable.courseCode,
          facultyId: variable.facultyId,
          variableId: variable.id,
          message: `Forward checking failed: No valid candidate slots remain for course '${variable.courseCode}' (${variable.isLab ? 'LAB' : 'THEORY'}).`,
        },
      };
    }

    candidateMap.set(variable.id, candidates);
  }

  // Dynamic MRV (Minimum Remaining Values):
  // 1. Laboratories always take precedence over theory (larger block size, more restrictive)
  // 2. Minimum remaining candidates count (smallest domain first)
  // 3. Tie break deterministically
  const orderedVariables = [...remainingVariables].sort((a, b) => {
    // Priority 1: Labs first
    if (a.isLab && !b.isLab) return -1;
    if (!a.isLab && b.isLab) return 1;

    // Priority 2: MRV - fewest remaining candidates
    const aCount = candidateMap.get(a.id).length;
    const bCount = candidateMap.get(b.id).length;
    if (aCount !== bCount) {
      return aCount - bCount;
    }

    // Priority 3: Alphabetical/deterministic ID tie-break
    return a.id.localeCompare(b.id);
  });

  return {
    feasible: true,
    orderedVariables,
    candidateMap,
  };
}

module.exports = {
  forwardCheckAndOrderMRV,
};
