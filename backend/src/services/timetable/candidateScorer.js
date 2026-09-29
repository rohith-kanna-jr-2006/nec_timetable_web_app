/**
 * Candidate Scorer & Least-Constraining Value (LCV) Evaluator
 *
 * Implements pedagogical soft-constraint scoring:
 * - Theory distribution across weekdays
 * - Avoidance of same-subject same-day clustering
 * - Adjacency penalty (prefers separated lectures)
 * - AM/PM session cognitive balance
 * - Faculty daily workload smoothing
 * - Single-lab morning preference (+100 bonus)
 * - Multi-lab afternoon balance
 * - LCV penalty for future domain shrinkage
 * - Deterministic seeded pseudo-random jitter for tie-breaking
 */

/**
 * Computes soft score for a candidate assignment.
 */
function scoreCandidate(candidate, variable, state, context) {
  const { gridConfig, totalLabsCount, rng } = context;
  const { classOccupancy, globalFacultyOccupancy, scheduledLabs } = state;
  const { periods } = gridConfig;

  let score = 0;

  // ----------------------------------------------------
  // 1. LAB-SPECIFIC SCORING
  // ----------------------------------------------------
  if (candidate.isLab) {
    if (totalLabsCount === 1) {
      // Single-lab rule: morning preferred (soft preference)
      if (candidate.session === 'MORNING') {
        score += 100;
      }
    } else if (totalLabsCount > 1) {
      // Multi-lab rule: at least one lab MUST be afternoon.
      // Heavily prioritize afternoon if none is scheduled yet
      const afternoonLabsCount = scheduledLabs.filter((lab) => lab.session === 'AFTERNOON').length;
      if (afternoonLabsCount === 0) {
        if (candidate.session === 'AFTERNOON') {
          score += 120;
        }
      } else {
        // Afternoon requirement already fulfilled, morning is fine
        if (candidate.session === 'MORNING') {
          score += 50;
        }
      }
    }

    // Prefer days that have fewer scheduled classes
    let classesOnDay = 0;
    for (const p of periods) {
      if (classOccupancy.has(`${candidate.day}_${p}`)) {
        classesOnDay++;
      }
    }
    score -= classesOnDay * 5;
  }

  // ----------------------------------------------------
  // 2. THEORY-SPECIFIC SCORING
  // ----------------------------------------------------
  if (!candidate.isLab) {
    const courseCode = variable.courseCode;
    const day = candidate.day;
    const period = candidate.period;

    // A. Day Distribution: Count existing periods of this course on this day
    let courseCountOnDay = 0;
    for (const p of periods) {
      const session = classOccupancy.get(`${day}_${p}`);
      if (session && session.courseCode === courseCode) {
        courseCountOnDay++;
      }
    }

    if (courseCountOnDay === 0) {
      // Bonus: Course not yet taught on this day -> good distribution
      score += 60;
    } else if (courseCountOnDay === 1) {
      // Slight penalty: course already taught once today
      score -= 25;
    } else {
      // Heavy penalty: course already has >= 2 periods today
      score -= 120;
    }

    // B. Adjacency: check immediate previous and next periods
    const pIdx = periods.indexOf(period);
    if (pIdx > 0) {
      const prevSession = classOccupancy.get(`${day}_${periods[pIdx - 1]}`);
      if (prevSession && prevSession.courseCode === courseCode) {
        score -= 40; // Adjacent repeat penalty
      }
    }
    if (pIdx < periods.length - 1) {
      const nextSession = classOccupancy.get(`${day}_${periods[pIdx + 1]}`);
      if (nextSession && nextSession.courseCode === courseCode) {
        score -= 40; // Adjacent repeat penalty
      }
    }

    // C. Faculty Daily Workload Smoothing: count periods faculty teaches today
    let facultyDayLoad = 0;
    for (const p of periods) {
      if (globalFacultyOccupancy.has(`${variable.facultyId}_${day}_${p}`)) {
        facultyDayLoad++;
      }
      const myClassSession = classOccupancy.get(`${day}_${p}`);
      if (myClassSession && myClassSession.facultyId === variable.facultyId) {
        facultyDayLoad++;
      }
    }

    if (facultyDayLoad <= 1) {
      score += 20; // Well-spaced faculty schedule
    } else if (facultyDayLoad >= 3) {
      score -= 35; // Avoid exhausting faculty on one day
    }
  }

  // ----------------------------------------------------
  // 3. LEAST-CONSTRAINING VALUE (LCV)
  // ----------------------------------------------------
  // Estimate future domain shrinkage on remaining unscheduled variables
  const remainingVars = state.remainingVariables || [];
  let futureCollisionPotential = 0;

  for (const remVar of remainingVars) {
    if (remVar.id === variable.id) continue;

    if (remVar.isLab) {
      // If remaining variable is a lab, and this candidate occupies periods in morning/afternoon of this day
      // It eliminates potential lab blocks on this day
      futureCollisionPotential += candidate.periods.length * 2;
    } else {
      // Remaining theory variable
      if (remVar.facultyId === variable.facultyId) {
        futureCollisionPotential += candidate.periods.length * 3;
      } else {
        futureCollisionPotential += candidate.periods.length;
      }
    }
  }

  score -= futureCollisionPotential * 2;

  // ----------------------------------------------------
  // 4. DETERMINISTIC SEEDED RANDOM JITTER
  // ----------------------------------------------------
  if (rng) {
    score += rng.next() * 0.1;
  }

  return score;
}

/**
 * Sorts valid candidates in descending order of score (highest first).
 */
function rankCandidates(candidates, variable, state, context) {
  const scored = candidates.map((cand) => ({
    candidate: cand,
    score: scoreCandidate(cand, variable, state, context),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.candidate);
}

module.exports = {
  scoreCandidate,
  rankCandidates,
};
