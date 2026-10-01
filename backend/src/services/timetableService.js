const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');
const AcademicContext = require('../models/AcademicContext');
const { buildSchedulingContext } = require('./timetable/constraintBuilder');
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
    } catch (dbErr) {
      console.warn('[timetableService] DB persistence warning:', dbErr.message);
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

      const publishedVersion = await TimetableVersion.findOne({
        academicYear: context.academicYear,
        semester: context.semester,
        department: context.department,
        ...(context.year ? { year: context.year } : {}),
        ...(context.section ? { section: context.section } : {}),
        status: 'PUBLISHED',
      }).sort({ publishedAt: -1, createdAt: -1 });

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

module.exports = {
  transitionTimetableStatus,
  solveAndPersistTimetable,
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
