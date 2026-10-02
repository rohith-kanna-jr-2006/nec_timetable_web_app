const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');
const AcademicContext = require('../models/AcademicContext');
const { buildSchedulingContext, buildSchedulingContextFromDesign } = require('./timetable/constraintBuilder');
const { solveTimetable } = require('./timetable/timetableSolver');
const {
  isFacultyAvailable,
  isClassPeriodAvailable,
  isTheoryPlacementValid,
  isLabPlacementValid,
  generateLabSchedule,
  generateTheorySchedule,
  validateTimetable,
  generateFacultyTimetable,
  generateClassTimetable,
} = require('./timetable/timetableCoreLogic');

const ALLOWED_TRANSITIONS = {
  NO_TIMETABLE: ['GENERATED', 'DRAFT'],
  DRAFT: ['GENERATED', 'NO_TIMETABLE'],
  GENERATED: ['PENDING_HOD_APPROVAL', 'DRAFT'],
  PENDING_HOD_APPROVAL: ['APPROVED', 'REJECTED'],
  REJECTED: ['GENERATED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'REJECTED'],
  PUBLISHED: [],
};

/**
 * Builds a structured error the controller can map without string matching.
 *
 * Phase 6: a state-machine violation is a 409 conflict about the data, not a
 * 403 authorization failure. Authorization denials keep STATE_TRANSITION_ERROR
 * so the existing Phase 1 contract is untouched.
 */
function _transitionError(message, code, statusCode, details = null) {
  const err = new Error(message);
  err.name = 'TimetableTransitionError';
  err.code = code;
  err.statusCode = statusCode;
  err.details = details;
  return err;
}

/**
 * Validates and executes a timetable version lifecycle status transition.
 */
async function transitionTimetableStatus(versionId, targetStatus, user, meta = {}) {
  const version = await TimetableVersion.findById(versionId);
  if (!version) {
    throw _transitionError('Timetable version not found.', 'VERSION_NOT_FOUND', 404, {
      timetableVersionId: versionId,
    });
  }

  // Phase 6 context integrity: every governance action (submit, approve, reject,
  // publish) must operate on the exact AcademicContext the caller believes it is
  // acting on. TimetableVersion.academicContextId is the authoritative anchor, so
  // it is never inferred from academicYear / semester / department / year /
  // section. Without a claim from the caller this check is a no-op.
  if (meta.academicContextId) {
    const claimed = meta.academicContextId.toString();
    const anchored = version.academicContextId ? version.academicContextId.toString() : null;
    if (anchored !== claimed) {
      throw _transitionError(
        `Timetable version '${version._id}' belongs to academic context '${anchored}', not to '${claimed}'.`,
        'TIMETABLE_VERSION_CONTEXT_MISMATCH',
        409,
        { timetableVersionId: version._id, versionContextId: anchored, requestedContextId: claimed }
      );
    }
  }

  const currentStatus = version.status;

  /**
   * Role-based status-transition authorization.
   *
   * Design authority  : TC (TimeTable Coordinator) + ADMIN
   *   Allowed targets : DRAFT, GENERATED, PENDING_HOD_APPROVAL
   *   Legacy note     : AC is temporarily treated as TC during the migration
   *                     period. Remove 'AC' from this list once all AC users
   *                     have been migrated to TC in the database.
   *
   * Approval authority: HOD + ADMIN
   *   Allowed targets : APPROVED, REJECTED, PUBLISHED
   *   HOD must NOT reach design-only targets (DRAFT, GENERATED) via this path
   *   because the route guard has already limited HOD to the status endpoint only.
   *
   * Phase 6: authorization is evaluated BEFORE the state machine, so a caller
   * who has no authority for a target always receives 403 (never a 409 that
   * would imply the transition itself was merely invalid).
   */
  const role = user.role;

  // Targets exclusively for HOD / ADMIN (approval workflow)
  const HOD_ONLY_TARGETS = ['APPROVED', 'REJECTED', 'PUBLISHED'];

  // Targets exclusively for TC / ADMIN (design workflow)
  // TC may submit (→ PENDING_HOD_APPROVAL), generate (→ GENERATED), draft (→ DRAFT),
  // and reset (→ NO_TIMETABLE from DRAFT).
  const TC_ONLY_TARGETS = ['NO_TIMETABLE', 'DRAFT', 'GENERATED', 'PENDING_HOD_APPROVAL'];

  if (HOD_ONLY_TARGETS.includes(targetStatus)) {
    // Only HOD or ADMIN can approve, reject, or publish
    if (!['HOD', 'ADMIN'].includes(role)) {
      throw _transitionError(
        `Only HOD has authority to transition timetable to ${targetStatus}.`,
        'STATE_TRANSITION_ERROR',
        403,
        { timetableVersionId: version._id, requestedStatus: targetStatus, role: role || null }
      );
    }
  } else if (TC_ONLY_TARGETS.includes(targetStatus)) {
    // TC (and legacy AC during migration) may perform design transitions.
    // HOD must NOT be able to design the timetable.
    if (!['TC', 'AC', 'ADMIN'].includes(role)) {
      throw _transitionError(
        `Only the TimeTable Coordinator has authority to transition timetable to ${targetStatus}.`,
        'STATE_TRANSITION_ERROR',
        403,
        { timetableVersionId: version._id, requestedStatus: targetStatus, role: role || null }
      );
    }
  } else {
    // Unknown target — catch-all rejection
    throw _transitionError(
      `Unauthorized role '${role}' for timetable status transition to ${targetStatus}.`,
      'STATE_TRANSITION_ERROR',
      403,
      { timetableVersionId: version._id, requestedStatus: targetStatus, role: role || null }
    );
  }

  // Regardless of role, if we are in PENDING_HOD_APPROVAL and the target is NOT
  // a HOD approval action, it must be blocked. (A TC cannot re-generate from this
  // state — the HOD must first reject, returning it to GENERATED/DRAFT.)
  if (currentStatus === 'PENDING_HOD_APPROVAL' && !['HOD', 'ADMIN'].includes(role)) {
    throw _transitionError(
      'Only HOD has authority to review or transition timetable from PENDING_HOD_APPROVAL.',
      'STATE_TRANSITION_ERROR',
      403,
      { timetableVersionId: version._id, currentStatus, role: role || null }
    );
  }

  // Phase 6: state-machine validation runs only for an authorized caller, so an
  // invalid edge is reported as a conflict about the data, never as an authz error.
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(targetStatus)) {
    throw _transitionError(
      `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowed.join(', ') || 'None'}`,
      'INVALID_TIMETABLE_STATUS_TRANSITION',
      409,
      {
        timetableVersionId: version._id,
        currentStatus,
        requestedStatus: targetStatus,
        allowedTransitions: allowed,
      }
    );
  }

  // Phase 6: a rejection must carry a usable reason. The model already stores
  // rejectionReason, so it is validated rather than silently defaulted away.
  if (targetStatus === 'REJECTED') {
    const reason = meta.rejectionReason;
    if (reason !== undefined && reason !== null && typeof reason !== 'string') {
      throw _transitionError('rejectionReason must be a string.', 'BAD_REQUEST', 400);
    }
    if (typeof reason === 'string' && reason.trim().length === 0) {
      throw _transitionError(
        'rejectionReason cannot be empty when rejecting a timetable.',
        'BAD_REQUEST',
        400
      );
    }
    if (typeof reason === 'string' && reason.length > 500) {
      throw _transitionError(
        'rejectionReason must not exceed 500 characters.',
        'BAD_REQUEST',
        400
      );
    }
  }

  // Phase 5: submitting a timetable for HOD approval is the single most
  // consequential TC action in the workflow.  Before the version becomes a
  // frozen review artifact it must clear the submission gate (sessions exist,
  // context is intact, HOD allocations unchanged, hard constraints intact).
  // Imported lazily to keep the module graph acyclic and the hot path cheap.
  let submissionReview = null;
  if (targetStatus === 'PENDING_HOD_APPROVAL') {
    // eslint-disable-next-line global-require
    const { validateVersionForHodSubmission } = require('./timetableSubmissionService');
    submissionReview = await validateVersionForHodSubmission({
      versionId,
      academicContextId: meta.academicContextId,
      user,
    });
  }

  version.status = targetStatus;

  if (targetStatus === 'GENERATED') {
    version.generatedBy = user.name || user.email;
  } else if (targetStatus === 'PENDING_HOD_APPROVAL') {
    version.submittedBy = user.name || user.email;
    version.submittedAt = new Date();
  } else if (targetStatus === 'APPROVED') {
    version.approvedBy = user.name || user.email;
    version.approvedAt = new Date();
    version.rejectionReason = null;
  } else if (targetStatus === 'PUBLISHED') {
    version.publishedAt = new Date();
  } else if (targetStatus === 'REJECTED') {
    version.rejectionReason = meta.rejectionReason || 'Rejected by HOD';
    // Phase 5: a rejected version returns to the TC as an editable artifact.
    // Clearing the submission stamps keeps the revision history honest — the
    // REJECTED -> GENERATED -> PENDING_HOD_APPROVAL cycle re-stamps on submit.
    version.submittedBy = null;
    version.submittedAt = null;
  }

  await version.save();

  if (submissionReview) {
    version.submissionReview = submissionReview;
  }

  return version;
}

/**
 * Solves timetable using CSP engine and persists generated sessions atomically.
 *
 * @param {Object} input - { academicContextId, timetableVersionId, assignmentPlan, generationSeed, options }
 * @param {Object} user - Requester user object
 * @returns {Object} Solution result with persisted sessions and metrics
 */
async function solveAndPersistTimetable(input, user = {}) {
  // 1. Build problem context & validate authoritative allocations
  const problemSpec = await buildSchedulingContext(input);

  // 2. Run in-memory CSP solver
  const solverOptions = {
    generationSeed: input.generationSeed,
    ...input.options,
  };

  const { version, context, allVariables } = problemSpec;

  // Published / Approved / Submitted immutability guard (Phase 5 adds
  // PENDING_HOD_APPROVAL: a submitted version is a frozen review artifact).
  if (version && ['PUBLISHED', 'APPROVED', 'PENDING_HOD_APPROVAL'].includes(version.status)) {
    return {
      success: false,
      code: 'VERSION_LOCKED',
      message: `Timetable version '${version.versionLabel || version._id}' is ${version.status} and cannot be modified.`,
      academicContextId: context ? context._id : null,
      timetableVersionId: version ? version._id : null,
      status: version.status,
      sessionsCreated: 0,
      sessions: [],
    };
  }

  const solution = await solveTimetable(problemSpec, solverOptions);

  if (!solution.success) {
    return {
      ...solution,
      academicContextId: context ? context._id : null,
      timetableVersionId: version ? version._id : null,
      status: version ? version.status : null,
      sessionsCreated: 0,
      sessions: [],
    };
  }

  // Zero-session safety: If solver succeeded but produced zero sessions when variables were required
  const requiredPeriods = (allVariables && allVariables.length) || 0;
  if (requiredPeriods > 0 && (!solution.sessions || solution.sessions.length === 0)) {
    return {
      success: false,
      code: 'ZERO_SESSIONS_GENERATED',
      message: `Solver completed but produced zero scheduled sessions when ${requiredPeriods} periods were required.`,
      academicContextId: context ? context._id : null,
      timetableVersionId: version ? version._id : null,
      status: version ? version.status : null,
      sessionsCreated: 0,
      sessions: [],
      diagnostics: solution.diagnostics,
      metrics: solution.metrics,
    };
  }

  // 3. Atomically persist generated sessions:
  const sessionsToInsert = solution.sessions.map((s) => ({
    ...s,
    class: context ? `${context.year || ''} ${context.department || ''} ${context.section || ''}`.trim() : (s.class || 'Classroom'),
    year: context ? context.year : (s.year || null),
    section: context ? context.section : (s.section || null),
    department: context ? context.department : (s.department || null),
    subject: s.courseName || s.courseCode,
    subjectType: s.sessionType || 'THEORY',
    faculty: s.facultyName || s.facultyId,
    startPeriod: s.period,
    endPeriod: s.period,
    timetableVersionId: version ? version._id : null,
    academicContextId: context ? context._id : null,
  }));

  let inserted = sessionsToInsert;
  const mongoose = require('mongoose');

  if (mongoose.connection.readyState === 1) {
    try {
      // Regeneration safety: only delete sessions belonging to exact context + exact working version
      await TimetableSession.deleteMany({
        timetableVersionId: version._id,
        academicContextId: context._id,
      });
      inserted = await TimetableSession.insertMany(sessionsToInsert);

      // Persistence assertion
      if (sessionsToInsert.length > 0 && inserted.length !== sessionsToInsert.length) {
        return {
          success: false,
          code: 'PERSISTENCE_FAILED',
          message: `Persistence assertion failed: expected ${sessionsToInsert.length} documents, but inserted ${inserted.length}.`,
          academicContextId: context ? context._id : null,
          timetableVersionId: version ? version._id : null,
          status: version ? version.status : null,
          sessionsCreated: inserted.length,
          sessions: inserted,
          diagnostics: solution.diagnostics,
        };
      }
    } catch (dbErr) {
      console.warn('[timetableService] DB persistence warning:', dbErr.message);
      return {
        success: false,
        code: 'PERSISTENCE_ERROR',
        message: `Database error while persisting timetable sessions: ${dbErr.message}`,
        academicContextId: context ? context._id : null,
        timetableVersionId: version ? version._id : null,
        status: version ? version.status : null,
        sessionsCreated: 0,
        sessions: [],
        diagnostics: solution.diagnostics,
      };
    }
  }

  // Update in-memory fallback sessions store for offline persistence
  try {
    const { ALL_SESSIONS } = require('../data/offlineFallbackData');
    if (Array.isArray(ALL_SESSIONS)) {
      // Remove any existing sessions for this context
      for (let i = ALL_SESSIONS.length - 1; i >= 0; i--) {
        if (
          ALL_SESSIONS[i].academicContextId &&
          context &&
          ALL_SESSIONS[i].academicContextId.toString() === context._id.toString()
        ) {
          ALL_SESSIONS.splice(i, 1);
        }
      }
      // Add newly generated sessions
      sessionsToInsert.forEach((s, idx) => {
        ALL_SESSIONS.push({
          ...s,
          _id: s._id || `65f0e00000000000000000${(idx + 1).toString(16).padStart(2, '0')}`,
        });
      });
    }
  } catch (_) {}

  // Update TimetableVersion metadata
  if (version) {
    version.status = 'GENERATED';
    version.totalScheduledPeriods = inserted.length;
    version.hardConflicts = 0;
    version.generatedBy = user.name || user.email || 'Coordinator';
    if (mongoose.connection.readyState === 1) {
      try {
        await version.save();
      } catch (_) {}
    }
  }

  return {
    success: true,
    academicContextId: context ? context._id : null,
    timetableVersionId: version ? version._id : null,
    timetableVersion: version,
    status: version ? version.status : 'GENERATED',
    generationSeed: solution.generationSeed,
    sessionsCreated: inserted.length,
    sessions: inserted,
    assignments: inserted,
    metrics: solution.metrics,
    diagnostics: solution.diagnostics,
  };
}

/**
 * Retrieves timetable sessions for a faculty member.
 * Strictly uses TimetableSession collection and isolates active version.
 */
async function getFacultySchedule(facultyId, versionId = null) {
  const mongoose = require('mongoose');
  let rawSessions = [];

  if (mongoose.connection.readyState === 1) {
    const filter = {
      $or: [{ facultyId }, { 'facultyAssignments.facultyId': facultyId }],
    };
    if (versionId) {
      filter.timetableVersionId = versionId;
    } else {
      const publishedVersions = await TimetableVersion.find({ status: 'PUBLISHED' });
      if (publishedVersions.length > 0) {
        filter.timetableVersionId = { $in: publishedVersions.map((v) => v._id) };
      } else {
        return [];
      }
    }
    rawSessions = await TimetableSession.find(filter).sort({ day: 1, period: 1 }).lean();
  } else {
    try {
      const { ALL_SESSIONS } = require('../data/offlineFallbackData');
      rawSessions = ALL_SESSIONS || [];
    } catch (_) {}
  }

  return generateFacultyTimetable(rawSessions, facultyId);
}

/**
 * Retrieves timetable sessions for an academic context (class).
 * Strictly enforces context and published version isolation.
 */
async function getClassSchedule(academicContextId, versionId = null) {
  const mongoose = require('mongoose');
  let rawSessions = [];

  if (mongoose.connection.readyState === 1) {
    const filter = { academicContextId };
    if (versionId) {
      filter.timetableVersionId = versionId;
    } else {
      const context = await AcademicContext.findById(academicContextId);
      if (!context) return [];

      // Phase 2: Prefer academicContextId anchor first, then 5-field fallback
      let publishedVersion = await TimetableVersion.findOne({
        academicContextId: context._id,
        status: 'PUBLISHED',
      }).sort({ publishedAt: -1, createdAt: -1 });

      if (!publishedVersion) {
        publishedVersion = await TimetableVersion.findOne({
          academicYear: context.academicYear,
          semester: context.semester,
          department: context.department,
          ...(context.year ? { year: context.year } : {}),
          ...(context.section ? { section: context.section } : {}),
          status: 'PUBLISHED',
        }).sort({ publishedAt: -1, createdAt: -1 });
      }

      if (!publishedVersion) return [];
      filter.timetableVersionId = publishedVersion._id;
    }
    rawSessions = await TimetableSession.find(filter).sort({ day: 1, period: 1 }).lean();
  } else {
    try {
      const { ALL_SESSIONS } = require('../data/offlineFallbackData');
      rawSessions = ALL_SESSIONS || [];
    } catch (_) {}
  }

  return generateClassTimetable(rawSessions, academicContextId);
}

/**
 * Phase 4 rollback helper.
 *
 * When a generation run has to create a brand-new working TimetableVersion but
 * the solve or the persist step fails, that version must not survive.  A
 * leftover version would make the TC design context report a generated
 * timetable that has zero sessions and would break the Phase 1/2 lifecycle.
 *
 * Pre-existing versions are always preserved — the TC may legitimately be
 * iterating on a DRAFT version.
 *
 * @param {Object} version                 - Resolved TimetableVersion (or null)
 * @param {boolean} createdByThisRun       - True when this run created the version
 * @returns {Promise<{keptVersionId: string|null, keptStatus: string|null}>}
 */
async function _discardVersionIfCreatedByThisRun(version, createdByThisRun) {
  if (!createdByThisRun || !version) {
    return {
      keptVersionId: version ? version._id : null,
      keptStatus: version ? version.status : null,
    };
  }

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return { keptVersionId: null, keptStatus: null };
    }

    // Only remove a version that is still empty; never delete real timetable data.
    const sessionCount = await TimetableSession.countDocuments({
      timetableVersionId: version._id,
    });

    if (sessionCount === 0) {
      await TimetableVersion.findByIdAndDelete(version._id);
      return { keptVersionId: null, keptStatus: null };
    }

    return { keptVersionId: version._id, keptStatus: version.status };
  } catch (_) {
    // Rollback is best-effort; never mask the original generation failure.
    return { keptVersionId: version._id, keptStatus: version.status };
  }
}

/**
 * Solves timetable using the Phase 4 server-derived design context path.
 *
 * Preferred generation pathway:
 *   1. Uses Phase 3 TC Design Context for batched, authoritative data loading
 *   2. Validates readiness (all required allocations complete)
 *   3. Validates frontend assignmentPlan against server truth (if provided)
 *   4. Runs the same CSP solver and persists sessions identically
 *
 * @param {Object} input - { academicContextId, timetableVersionId, assignmentPlan, generationSeed, options }
 * @param {Object} user - Requester user object
 * @returns {Object} Solution result with persisted sessions and metrics
 */
async function solveFromDesignContext(input, user = {}) {
  // 1. Build problem context using design-derived batched path
  const problemSpec = await buildSchedulingContextFromDesign(input);

  // 2. Run in-memory CSP solver (same as solveAndPersistTimetable)
  const solverOptions = {
    generationSeed: input.generationSeed,
    ...input.options,
  };

  const { version, context, allVariables, _designContext, versionCreatedByThisRun } = problemSpec;

  // Published / Approved / Submitted immutability guard (Phase 5 adds
  // PENDING_HOD_APPROVAL: a submitted version is a frozen review artifact).
  if (version && ['PUBLISHED', 'APPROVED', 'PENDING_HOD_APPROVAL'].includes(version.status)) {
    return {
      success: false,
      code: 'VERSION_LOCKED',
      message: `Timetable version '${version.versionLabel || version._id}' is ${version.status} and cannot be modified.`,
      academicContextId: context ? context._id : null,
      timetableVersionId: version ? version._id : null,
      status: version.status,
      sessionsCreated: 0,
      sessions: [],
    };
  }

  const solution = await solveTimetable(problemSpec, solverOptions);

  if (!solution.success) {
    // Phase 4: a working version created for this failed run must not survive.
    // Leaving a version behind would misreport readiness to the TC screen and
    // break the Phase 1 governance state machine.
    const rollback = await _discardVersionIfCreatedByThisRun(version, versionCreatedByThisRun);
    return {
      ...solution,
      academicContextId: context ? context._id : null,
      timetableVersionId: rollback.keptVersionId,
      status: rollback.keptStatus,
      sessionsCreated: 0,
      sessions: [],
      designContext: _designContext,
    };
  }

  // Zero-session safety
  const requiredPeriods = (allVariables && allVariables.length) || 0;
  if (requiredPeriods > 0 && (!solution.sessions || solution.sessions.length === 0)) {
    const rollback = await _discardVersionIfCreatedByThisRun(version, versionCreatedByThisRun);
    return {
      success: false,
      code: 'ZERO_SESSIONS_GENERATED',
      message: `Solver completed but produced zero scheduled sessions when ${requiredPeriods} periods were required.`,
      academicContextId: context ? context._id : null,
      timetableVersionId: rollback.keptVersionId,
      status: rollback.keptStatus,
      sessionsCreated: 0,
      sessions: [],
      diagnostics: solution.diagnostics,
      metrics: solution.metrics,
      designContext: _designContext,
    };
  }

  // 3. Persist sessions (identical to solveAndPersistTimetable)
  const sessionsToInsert = solution.sessions.map((s) => ({
    ...s,
    class: context ? `${context.year || ''} ${context.department || ''} ${context.section || ''}`.trim() : (s.class || 'Classroom'),
    year: context ? context.year : (s.year || null),
    section: context ? context.section : (s.section || null),
    department: context ? context.department : (s.department || null),
    subject: s.courseName || s.courseCode,
    subjectType: s.sessionType || 'THEORY',
    faculty: s.facultyName || s.facultyId,
    startPeriod: s.period,
    endPeriod: s.period,
    timetableVersionId: version ? version._id : null,
    academicContextId: context ? context._id : null,
  }));

  let inserted = sessionsToInsert;
  const mongoose = require('mongoose');

  if (mongoose.connection.readyState === 1) {
    try {
      await TimetableSession.deleteMany({
        timetableVersionId: version._id,
        academicContextId: context._id,
      });
      inserted = await TimetableSession.insertMany(sessionsToInsert);

      if (sessionsToInsert.length > 0 && inserted.length !== sessionsToInsert.length) {
        return {
          success: false,
          code: 'PERSISTENCE_FAILED',
          message: `Persistence assertion failed: expected ${sessionsToInsert.length} documents, but inserted ${inserted.length}.`,
          academicContextId: context ? context._id : null,
          timetableVersionId: version ? version._id : null,
          status: version ? version.status : null,
          sessionsCreated: inserted.length,
          sessions: inserted,
          diagnostics: solution.diagnostics,
          designContext: _designContext,
        };
      }
    } catch (dbErr) {
      console.warn('[timetableService] DB persistence warning:', dbErr.message);
      return {
        success: false,
        code: 'PERSISTENCE_ERROR',
        message: `Database error while persisting timetable sessions: ${dbErr.message}`,
        academicContextId: context ? context._id : null,
        timetableVersionId: version ? version._id : null,
        status: version ? version.status : null,
        sessionsCreated: 0,
        sessions: [],
        diagnostics: solution.diagnostics,
        designContext: _designContext,
      };
    }
  }

  // Update version metadata
  if (version) {
    version.status = 'GENERATED';
    version.totalScheduledPeriods = inserted.length;
    version.hardConflicts = 0;
    version.generatedBy = user.name || user.email || 'Coordinator';
    if (mongoose.connection.readyState === 1) {
      try {
        await version.save();
      } catch (_) {}
    }
  }

  return {
    success: true,
    academicContextId: context ? context._id : null,
    timetableVersionId: version ? version._id : null,
    timetableVersion: version,
    status: version ? version.status : 'GENERATED',
    generationSeed: solution.generationSeed,
    sessionsCreated: inserted.length,
    sessions: inserted,
    assignments: inserted,
    metrics: solution.metrics,
    diagnostics: solution.diagnostics,
    designContext: _designContext,
  };
}

module.exports = {
  transitionTimetableStatus,
  ALLOWED_TRANSITIONS,
  HOD_ONLY_TARGETS: ['APPROVED', 'REJECTED', 'PUBLISHED'],
  TC_ONLY_TARGETS: ['NO_TIMETABLE', 'DRAFT', 'GENERATED', 'PENDING_HOD_APPROVAL'],
  solveAndPersistTimetable,
  solveFromDesignContext,
  getFacultySchedule,
  getClassSchedule,
  isFacultyAvailable,
  isClassPeriodAvailable,
  isTheoryPlacementValid,
  isLabPlacementValid,
  generateLabSchedule,
  generateTheorySchedule,
  validateTimetable,
  generateFacultyTimetable,
  generateClassTimetable,
};
