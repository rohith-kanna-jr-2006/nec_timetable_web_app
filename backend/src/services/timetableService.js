const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');

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

  // Only HOD or ADMIN can approve or publish
  if (['APPROVED', 'PUBLISHED'].includes(targetStatus) && !['HOD', 'ADMIN'].includes(user.role)) {
    throw new Error(`Only HOD has authority to transition timetable to ${targetStatus}.`);
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
 * Retrieves timetable sessions for a faculty member.
 * Strictly uses TimetableSession collection.
 */
async function getFacultySchedule(facultyId, versionId = null) {
  const filter = { facultyId };
  if (versionId) {
    filter.timetableVersionId = versionId;
  }
  return TimetableSession.find(filter).sort({ day: 1, period: 1 });
}

/**
 * Retrieves timetable sessions for an academic context (class).
 */
async function getClassSchedule(academicContextId, versionId = null) {
  const filter = { academicContextId };
  if (versionId) {
    filter.timetableVersionId = versionId;
  }
  return TimetableSession.find(filter).sort({ day: 1, period: 1 });
}

module.exports = {
  transitionTimetableStatus,
  getFacultySchedule,
  getClassSchedule,
};
