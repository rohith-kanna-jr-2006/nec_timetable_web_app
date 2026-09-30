const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');
const AcademicContext = require('../models/AcademicContext');
const { buildSchedulingContext } = require('./timetable/constraintBuilder');
const { solveTimetable } = require('./timetable/timetableSolver');

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
 * Validates and executes a timetable version lifecycle status transition.
 */
async function transitionTimetableStatus(versionId, targetStatus, user, meta = {}) {
  const version = await TimetableVersion.findById(versionId);
  if (!version) {
    throw new Error('Timetable version not found.');
  }

  const currentStatus = version.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowed.join(', ') || 'None'}`
    );
  }

  // Only HOD or ADMIN can approve, reject, or publish
  if (['APPROVED', 'PUBLISHED', 'REJECTED'].includes(targetStatus) && !['HOD', 'ADMIN'].includes(user.role)) {
    throw new Error(`Only HOD has authority to transition timetable to ${targetStatus}.`);
  }

  // AC cannot review or transition from PENDING_HOD_APPROVAL
  if (currentStatus === 'PENDING_HOD_APPROVAL' && !['HOD', 'ADMIN'].includes(user.role)) {
    throw new Error('Only HOD has authority to review or transition timetable from PENDING_HOD_APPROVAL.');
  }

  if (!['HOD', 'AC', 'ADMIN'].includes(user.role)) {
    throw new Error('Unauthorized role for timetable status transition.');
  }

  version.status = targetStatus;

  if (targetStatus === 'GENERATED') {
    version.generatedBy = user.name || user.email;
  } else if (targetStatus === 'PENDING_HOD_APPROVAL') {
    version.submittedBy = user.name || user.email;
  } else if (targetStatus === 'APPROVED') {
    version.approvedBy = user.name || user.email;
    version.approvedAt = new Date();
    version.rejectionReason = null;
  } else if (targetStatus === 'PUBLISHED') {
    version.publishedAt = new Date();
  } else if (targetStatus === 'REJECTED') {
    version.rejectionReason = meta.rejectionReason || 'Rejected by HOD';
  }

  await version.save();
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
  const solution = await solveTimetable(problemSpec, solverOptions);

  if (!solution.success) {
    return solution;
  }

  const { version, context } = problemSpec;

  // 3. Atomically persist generated sessions:
  // Remove previously generated sessions for this specific academic context and draft version
  await TimetableSession.deleteMany({
    timetableVersionId: version._id,
    academicContextId: context._id,
  });

  // Assign concrete version and context IDs to sessions
  const sessionsToInsert = solution.sessions.map((s) => ({
    ...s,
    timetableVersionId: version._id,
    academicContextId: context._id,
  }));

  const inserted = await TimetableSession.insertMany(sessionsToInsert);

  // Update TimetableVersion metadata
  version.status = 'GENERATED';
  version.totalScheduledPeriods = inserted.length;
  version.hardConflicts = 0;
  version.generatedBy = user.name || user.email || 'Coordinator';
  await version.save();

  return {
    success: true,
    timetableVersion: version,
    generationSeed: solution.generationSeed,
    sessionsCreated: inserted.length,
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
  const filter = {
    $or: [{ facultyId }, { 'facultyAssignments.facultyId': facultyId }],
  };
  if (versionId) {
    filter.timetableVersionId = versionId;
  } else {
    // Only published versions populate public faculty schedule to prevent draft session leakage
    const publishedVersions = await TimetableVersion.find({ status: 'PUBLISHED' });
    if (publishedVersions.length > 0) {
      filter.timetableVersionId = { $in: publishedVersions.map((v) => v._id) };
    } else {
      // If no published versions exist, do not leak draft sessions into public faculty schedule
      return [];
    }
  }
  return TimetableSession.find(filter).sort({ day: 1, period: 1 });
}

/**
 * Retrieves timetable sessions for an academic context (class).
 * Strictly enforces context and published version isolation.
 */
async function getClassSchedule(academicContextId, versionId = null) {
  const filter = { academicContextId };
  if (versionId) {
    filter.timetableVersionId = versionId;
  } else {
    // Strictly isolate to PUBLISHED version for default class schedule
    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return [];
    }

    const publishedVersion = await TimetableVersion.findOne({
      academicYear: context.academicYear,
      semester: context.semester,
      department: context.department,
      ...(context.year ? { year: context.year } : {}),
      ...(context.section ? { section: context.section } : {}),
      status: 'PUBLISHED',
    }).sort({ publishedAt: -1, createdAt: -1 });

    if (!publishedVersion) {
      // No published version exists: return empty array, do NOT leak unpublished drafts
      return [];
    }
    filter.timetableVersionId = publishedVersion._id;
  }
  return TimetableSession.find(filter).sort({ day: 1, period: 1 });
}

module.exports = {
  transitionTimetableStatus,
  solveAndPersistTimetable,
  getFacultySchedule,
  getClassSchedule,
};
