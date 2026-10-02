/**
 * TC Timetable Submission Service (Phase 5)
 *
 * Single authority for "may this TimeTable Coordinator submit this exact
 * timetable version for HOD approval?".
 *
 * The gate runs BEFORE the GENERATED -> PENDING_HOD_APPROVAL transition and
 * enforces, in order:
 *   1.  the version exists                          -> VERSION_NOT_FOUND
 *   2.  the version is anchored to an AcademicContext -> TIMETABLE_NOT_READY_FOR_SUBMISSION
 *   3.  the caller holds design authority (TC/AC/ADMIN) -> UNAUTHORIZED_TIMETABLE_SUBMISSION
 *   4.  the version is in GENERATED state            -> TIMETABLE_NOT_READY_FOR_SUBMISSION
 *   5.  the claimed academic context matches the anchor -> TIMETABLE_VERSION_CONTEXT_MISMATCH
 *   6.  the version has scheduled sessions           -> TIMETABLE_NOT_READY_FOR_SUBMISSION
 *   7.  every session belongs to that exact context + version (no orphans)
 *   8.  HOD allocations are unchanged since generation -> HOD_ALLOCATION_CHANGED_AFTER_GENERATION
 *   9.  the existing hard-constraint validator passes   -> TIMETABLE_VALIDATION_FAILED
 *
 * Solver-internal layout heuristics (period counts, lab block shape, theory
 * session packing) are reported as non-blocking warnings: the validator is the
 * solver's *final-solution* checker, and a version may legitimately be
 * hand-assembled by the TC through POST /api/timetable/session.  Data-integrity
 * failures — class conflicts, faculty conflicts, duplicate sessions, wrong HOD
 * faculty, periods outside the grid — always block submission.
 */

const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');
const AcademicContext = require('../models/AcademicContext');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const { validateGeneratedSchedule } = require('./timetable/timetableValidator');
const { resolveRequirementsFromDesignData } = require('./timetable/constraintBuilder');
const { getTCTimetableDesignContext } = require('./tcDesignContextService');
const { buildReviewSummary, toReviewSession, loadCourseNameMap } = require('./timetableReviewService');
const { DEFAULT_DAYS, DEFAULT_PERIODS } = require('./timetable/timetableGrid');

// Roles permitted to submit a timetable for HOD approval.
// 'AC' is retained only for the legacy AC -> TC migration period.
const SUBMITTER_ROLES = ['TC', 'AC', 'ADMIN'];

// The one status the TC may submit from.
const SUBMITTABLE_FROM_STATUS = 'GENERATED';

// Statuses that must never be re-submitted or silently regenerated.
const SUBMISSION_LOCKED_STATUSES = ['PENDING_HOD_APPROVAL', 'APPROVED', 'PUBLISHED'];

// Validator findings that make a timetable unsendable. Everything else is
// surfaced as a warning so the TC still sees it on the review screen.
//
// HOD_ALLOCATION_REQUIRED is deliberately absent: a course missing from the
// design-context requirement map is an allocation-completeness gap, not a
// contradiction. It is already reported (non-blocking) by
// detectStaleHodAllocations(), which reads HODFacultyAllocation directly.
// HOD_FACULTY_MISMATCH is the blocking check — that one means the timetable
// names a faculty the HOD did not approve for that course.
const BLOCKING_VALIDATION_CODES = [
  'CLASS_TIME_CONFLICT',
  'DUPLICATE_SESSION',
  'FACULTY_TIME_CONFLICT',
  'HOD_FACULTY_MISMATCH',
  'INVALID_PERIOD',
];

/** Error carrying an HTTP status + the structured code used by errorResponse(). */
class TimetableSubmissionError extends Error {
  constructor(message, code, statusCode = 409, details = null) {
    super(message);
    this.name = 'TimetableSubmissionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Normalises a faculty id for comparison (trim + upper-case).
 * @param {string} value
 * @returns {string}
 */
function _norm(value) {
  return (value || '').trim().toUpperCase();
}

/**
 * Compares a generated version against the current HOD allocation truth.
 *
 * A version generated before an allocation change is stale: submitting it
 * would ratify a timetable no longer backed by the HOD's decision. Each
 * conflict names the course, the faculty the timetable actually uses, and the
 * faculty the HOD has currently approved.
 *
 * Two severities are reported:
 *   - blocking (HOD_FACULTY_CHANGED): the HOD reassigned a course after the
 *     timetable was generated. The timetable demonstrably contradicts the HOD's
 *     current decision and must not be submitted.
 *   - non-blocking (HOD_ALLOCATION_MISSING): a scheduled course has no current
 *     allocation at all. This is a curriculum/allocation completeness gap, not
 *     a contradiction, and is surfaced to the TC as a warning so legacy
 *     contexts keep working while AC -> TC migration is in progress.
 *
 * @param {string|ObjectId} academicContextId
 * @param {Array} sessions      - Lean TimetableSession documents
 * @returns {Promise<Array>} findings; each carries a `blocking` flag
 */
async function detectStaleHodAllocations(academicContextId, sessions) {
  const allocations = await HODFacultyAllocation.find({
    academicContextId,
    status: { $ne: 'REJECTED' },
  }).lean();

  // courseCode -> { facultyIds: Set, primary: string }
  const approvedByCourse = new Map();
  for (const alloc of allocations) {
    if (!alloc.courseCode) continue;
    const entry = approvedByCourse.get(alloc.courseCode) || { facultyIds: new Set(), primary: null };
    if (alloc.facultyId) {
      entry.facultyIds.add(_norm(alloc.facultyId));
      if (!entry.primary) entry.primary = alloc.facultyId;
    }
    for (const fa of alloc.facultyAssignments || []) {
      if (fa && fa.facultyId) entry.facultyIds.add(_norm(fa.facultyId));
    }
    approvedByCourse.set(alloc.courseCode, entry);
  }

  // One representative session per course — every period of a course shares the
  // same instructor set, so a single pass is enough.
  const sessionsByCourse = new Map();
  for (const s of sessions) {
    if (!sessionsByCourse.has(s.courseCode)) sessionsByCourse.set(s.courseCode, s);
  }

  const findings = [];

  for (const [courseCode, session] of sessionsByCourse.entries()) {
    const approved = approvedByCourse.get(courseCode);
    const generatedFaculty = Array.from(
      new Set(
        (session.facultyAssignments || [])
          .map((a) => a.facultyId)
          .filter(Boolean)
          .concat(session.facultyId ? [session.facultyId] : [])
      )
    );

    if (!approved || approved.facultyIds.size === 0) {
      findings.push({
        blocking: false,
        reason: 'HOD_ALLOCATION_MISSING',
        courseCode,
        generatedFaculty,
        currentApprovedFaculty: [],
        message:
          `Course '${courseCode}' has no current HOD faculty allocation, but the generated ` +
          `timetable schedules it with [${generatedFaculty.join(', ')}].`,
      });
      continue;
    }

    const unapproved = generatedFaculty.filter((fid) => !approved.facultyIds.has(_norm(fid)));
    if (unapproved.length > 0) {
      const currentFaculty = Array.from(approved.facultyIds);
      findings.push({
        blocking: true,
        reason: 'HOD_FACULTY_CHANGED',
        courseCode,
        generatedFaculty,
        currentApprovedFaculty: currentFaculty,
        unapprovedFaculty: unapproved,
        message:
          `Course '${courseCode}' was generated with [${unapproved.join(', ')}] but the current ` +
          `HOD allocation approves [${currentFaculty.join(', ')}].`,
      });
    }
  }

  return findings;
}

/**
 * Runs the existing hard-constraint validator over the persisted sessions.
 *
 * Reuses the solver's validator rather than re-implementing conflict rules in
 * the controller. Solver-only layout heuristics are separated from integrity
 * failures so the TC is never blocked for a stylistic deviation.
 *
 * @param {Object} params
 * @param {Object} params.context   - AcademicContext document
 * @param {Array}  params.sessions - Lean TimetableSession documents
 * @returns {Promise<{blocking: Array, warnings: Array, checkedRequirementCount: number}>}
 */
async function runTimetableValidation({ context, sessions }) {
  const designResult = await getTCTimetableDesignContext(context._id);

  if (!designResult.success) {
    // The cohort itself cannot be reviewed (curriculum/context problem).
    // This is an allocation-integrity failure, not a timetable layout failure.
    throw new TimetableSubmissionError(
      designResult.message ||
        'Timetable cannot be submitted because the academic context is not in a reviewable state.',
      'TIMETABLE_VALIDATION_FAILED',
      409,
      { academicContextId: context._id, reason: designResult.code || 'DESIGN_CONTEXT_UNAVAILABLE' }
    );
  }

  const designData = designResult.data;
  const { resolvedRequirements } = resolveRequirementsFromDesignData(designData, context._id);

  const hodAllocationsMap = new Map();
  resolvedRequirements.forEach((r) => {
    hodAllocationsMap.set(r.courseCode, {
      facultyId: r.facultyId,
      facultyName: r.facultyName,
      allocationType: r.isLab ? 'LAB_PRIMARY' : 'THEORY',
    });
  });

  const result = validateGeneratedSchedule(sessions, {
    context,
    resolvedRequirements,
    hodAllocationsMap,
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    existingGlobalOccupancy: new Map(),
    existingLockedSessions: [],
  });

  const findings = Array.isArray(result.errors) ? result.errors : [];
  const blocking = findings.filter((e) => BLOCKING_VALIDATION_CODES.includes(e.code));
  const warnings = findings.filter((e) => !BLOCKING_VALIDATION_CODES.includes(e.code));

  return { blocking, warnings, checkedRequirementCount: resolvedRequirements.length };
}

/**
 * Validates that a timetable version may be submitted for HOD approval.
 *
 * @param {Object} params
 * @param {string} params.versionId          - TimetableVersion _id
 * @param {string} [params.academicContextId] - Context claimed by the caller
 * @param {Object} params.user               - Authenticated requester
 * @returns {Promise<Object>} Review payload attached to a successful submission
 * @throws {TimetableSubmissionError}
 */
async function validateVersionForHodSubmission({ versionId, academicContextId, user }) {
  const requesterRole = (user && user.role) || null;

  // 1. Version must exist
  const version = await TimetableVersion.findById(versionId);
  if (!version) {
    throw new TimetableSubmissionError(
      `Timetable version '${versionId}' not found.`,
      'VERSION_NOT_FOUND',
      404,
      { timetableVersionId: versionId }
    );
  }

  // 2. Version must be anchored to exactly one AcademicContext
  if (!version.academicContextId) {
    throw new TimetableSubmissionError(
      'Timetable version is not anchored to an academic context and cannot be submitted.',
      'TIMETABLE_NOT_READY_FOR_SUBMISSION',
      409,
      {
        timetableVersionId: version._id,
        academicContextId: null,
        status: version.status,
        reason: 'MISSING_ACADEMIC_CONTEXT',
      }
    );
  }

  // 3. Design authority only
  if (!SUBMITTER_ROLES.includes(requesterRole)) {
    throw new TimetableSubmissionError(
      `Only the TimeTable Coordinator may submit a timetable for HOD approval. Role '${requesterRole}' is not authorized.`,
      'UNAUTHORIZED_TIMETABLE_SUBMISSION',
      403,
      { timetableVersionId: version._id, role: requesterRole || null }
    );
  }

  // 4. State gate
  if (SUBMISSION_LOCKED_STATUSES.includes(version.status)) {
    throw new TimetableSubmissionError(
      `Timetable version is already ${version.status} and cannot be submitted again.`,
      version.status === 'PENDING_HOD_APPROVAL'
        ? 'TIMETABLE_NOT_READY_FOR_SUBMISSION'
        : 'TIMETABLE_VERSION_NOT_EDITABLE',
      409,
      {
        timetableVersionId: version._id,
        academicContextId: version.academicContextId,
        status: version.status,
        reason: version.status === 'PENDING_HOD_APPROVAL' ? 'ALREADY_SUBMITTED' : 'VERSION_LOCKED',
      }
    );
  }

  if (version.status !== SUBMITTABLE_FROM_STATUS) {
    throw new TimetableSubmissionError(
      `Only a ${SUBMITTABLE_FROM_STATUS} timetable can be submitted for HOD approval. This version is ${version.status}.`,
      'TIMETABLE_NOT_READY_FOR_SUBMISSION',
      409,
      {
        timetableVersionId: version._id,
        academicContextId: version.academicContextId,
        status: version.status,
        expectedStatus: SUBMITTABLE_FROM_STATUS,
        reason: 'INVALID_STATE',
      }
    );
  }

  // 5. Version must belong to the claimed academic context
  const versionContextId = version.academicContextId.toString();
  if (academicContextId && academicContextId.toString() !== versionContextId) {
    throw new TimetableSubmissionError(
      `Timetable version '${version._id}' belongs to academic context '${versionContextId}', not to '${academicContextId}'.`,
      'TIMETABLE_VERSION_CONTEXT_MISMATCH',
      409,
      {
        timetableVersionId: version._id,
        versionContextId,
        requestedContextId: academicContextId.toString(),
      }
    );
  }

  const context = await AcademicContext.findById(versionContextId);
  if (!context) {
    throw new TimetableSubmissionError(
      `Academic context '${versionContextId}' referenced by this timetable version no longer exists.`,
      'TIMETABLE_VERSION_CONTEXT_MISMATCH',
      409,
      { timetableVersionId: version._id, versionContextId, reason: 'CONTEXT_NOT_RESOLVABLE' }
    );
  }

  // 6/7. Sessions must exist and belong to this exact context + version
  const sessions = await TimetableSession.find({ timetableVersionId: version._id }).lean();

  if (sessions.length === 0) {
    throw new TimetableSubmissionError(
      'Timetable contains no scheduled sessions and cannot be submitted for HOD approval.',
      'TIMETABLE_NOT_READY_FOR_SUBMISSION',
      409,
      {
        academicContextId: context._id,
        timetableVersionId: version._id,
        sessionCount: 0,
      }
    );
  }

  const versionIdString = version._id.toString();
  const orphanSessions = sessions
    .filter(
      (s) =>
        !s.academicContextId ||
        s.academicContextId.toString() !== versionContextId ||
        (s.timetableVersionId && s.timetableVersionId.toString() !== versionIdString)
    )
    .map((s) => ({
      sessionId: s._id,
      courseCode: s.courseCode,
      day: s.day,
      period: s.period,
      academicContextId: s.academicContextId ? s.academicContextId.toString() : null,
      timetableVersionId: s.timetableVersionId ? s.timetableVersionId.toString() : null,
    }));

  if (orphanSessions.length > 0) {
    throw new TimetableSubmissionError(
      `Timetable version contains ${orphanSessions.length} session(s) that do not belong to this academic context and version.`,
      'TIMETABLE_NOT_READY_FOR_SUBMISSION',
      409,
      {
        academicContextId: context._id,
        timetableVersionId: version._id,
        reason: 'ORPHAN_SESSIONS',
        orphanSessions,
      }
    );
  }

  // 8. HOD allocation truth must still match the generated timetable
  const allocationFindings = await detectStaleHodAllocations(context._id, sessions);
  const staleAllocations = allocationFindings.filter((f) => f.blocking);
  const allocationWarnings = allocationFindings.filter((f) => !f.blocking);

  if (staleAllocations.length > 0) {
    throw new TimetableSubmissionError(
      'HOD faculty allocations changed after this timetable was generated. Regenerate the timetable before submitting it.',
      'HOD_ALLOCATION_CHANGED_AFTER_GENERATION',
      409,
      {
        academicContextId: context._id,
        timetableVersionId: version._id,
        conflicts: staleAllocations,
      }
    );
  }

  // 9. Existing hard-constraint validation layer
  const validation = await runTimetableValidation({ context, sessions });
  if (validation.blocking.length > 0) {
    throw new TimetableSubmissionError(
      `Timetable failed validation with ${validation.blocking.length} blocking issue(s) and cannot be submitted.`,
      'TIMETABLE_VALIDATION_FAILED',
      409,
      {
        academicContextId: context._id,
        timetableVersionId: version._id,
        errors: validation.blocking,
        warningCount: validation.warnings.length + allocationWarnings.length,
      }
    );
  }

  const courseNameMap = await loadCourseNameMap(sessions);
  const reviewSessions = sessions.map((s) => toReviewSession(s, courseNameMap));

  return {
    academicContextId: context._id,
    timetableVersionId: version._id,
    version,
    context,
    sessionCount: reviewSessions.length,
    summary: buildReviewSummary(reviewSessions),
    validation: {
      isValid: true,
      checkedRequirementCount: validation.checkedRequirementCount,
      warningCount: validation.warnings.length + allocationWarnings.length,
      warnings: [...validation.warnings, ...allocationWarnings],
    },
    sessions: reviewSessions,
  };
}

/**
 * True when a version may no longer be modified by the TC.
 * @param {string} status
 * @returns {boolean}
 */
function isVersionSubmissionLocked(status) {
  return SUBMISSION_LOCKED_STATUSES.includes(status);
}

/**
 * True once the TC has submitted the version and it is awaiting HOD review.
 *
 * Phase 5 freezes exactly this state: a submitted version is a review artifact
 * the HOD is looking at, so its sessions must not change underneath them.
 *
 * @param {string} status
 * @returns {boolean}
 */
function isVersionSubmittedForApproval(status) {
  return status === 'PENDING_HOD_APPROVAL';
}

module.exports = {
  TimetableSubmissionError,
  SUBMITTER_ROLES,
  SUBMITTABLE_FROM_STATUS,
  SUBMISSION_LOCKED_STATUSES,
  BLOCKING_VALIDATION_CODES,
  detectStaleHodAllocations,
  runTimetableValidation,
  validateVersionForHodSubmission,
  isVersionSubmissionLocked,
  isVersionSubmittedForApproval,
};
