const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');
const {
  transitionTimetableStatus,
  getFacultySchedule,
  getClassSchedule,
} = require('../services/timetableService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get timetable versions
 * GET /api/timetable/versions
 */
async function getVersions(req, res, next) {
  try {
    const { department, semester, academicYear, status } = req.query;
    const query = {};

    if (department) query.department = department.toUpperCase().trim();
    if (semester) query.semester = semester.trim();
    if (academicYear) query.academicYear = academicYear.trim();
    if (status) query.status = status;

    const versions = await TimetableVersion.find(query).sort({ createdAt: -1 });
    return successResponse(res, versions);
  } catch (error) {
    next(error);
  }
}

/**
 * Get single version by ID
 * GET /api/timetable/version/:id
 */
async function getVersionById(req, res, next) {
  try {
    const version = await TimetableVersion.findById(req.params.id);
    if (!version) {
      return errorResponse(res, 'Timetable version not found', 404, 'NOT_FOUND');
    }
    return successResponse(res, version);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new timetable version
 * POST /api/timetable/version
 */
async function createVersion(req, res, next) {
  try {
    const { academicYear, semester, department, year, section, versionLabel } = req.body;

    const version = await TimetableVersion.create({
      academicYear,
      semester,
      department: department.toUpperCase().trim(),
      year: year || null,
      section: section || null,
      versionLabel: versionLabel || 'v1.0',
      status: 'NO_TIMETABLE',
      generatedBy: req.user ? req.user.name : null,
    });

    return successResponse(res, version, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Transition timetable version status
 * PATCH /api/timetable/version/:id/status
 */
async function transitionVersion(req, res, next) {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!status) {
      return errorResponse(res, 'Status is required', 400, 'BAD_REQUEST');
    }

    const updated = await transitionTimetableStatus(id, status, req.user || {}, { rejectionReason });
    return successResponse(res, updated);
  } catch (error) {
    if (error.message.includes('Only HOD has authority') || error.message.includes('Invalid status transition')) {
      return errorResponse(res, error.message, 403, 'STATE_TRANSITION_ERROR');
    }
    next(error);
  }
}

/**
 * Get schedule for a faculty member
 * GET /api/timetable/faculty/:facultyId
 */
async function getFacultyTimetable(req, res, next) {
  try {
    const { facultyId } = req.params;
    const { versionId } = req.query;

    const sessions = await getFacultySchedule(facultyId, versionId);
    return successResponse(res, { facultyId, sessionCount: sessions.length, sessions });
  } catch (error) {
    next(error);
  }
}

/**
 * Get schedule for a class
 * GET /api/timetable/class/:academicContextId
 */
async function getClassTimetable(req, res, next) {
  try {
    const { academicContextId } = req.params;
    const { versionId } = req.query;

    const sessions = await getClassSchedule(academicContextId, versionId);
    return successResponse(res, { academicContextId, sessionCount: sessions.length, sessions });
  } catch (error) {
    next(error);
  }
}

/**
 * Get published timetable for a class
 * GET /api/timetable/published/:academicContextId
 */
async function getPublishedClassTimetable(req, res, next) {
  try {
    const { academicContextId } = req.params;

    // Find latest published timetable version
    const publishedVersion = await TimetableVersion.findOne({ status: 'PUBLISHED' }).sort({ publishedAt: -1 });

    if (!publishedVersion) {
      return successResponse(res, {
        academicContextId,
        isPublished: false,
        message: 'No published timetable version found.',
        sessions: [],
      });
    }

    const sessions = await getClassSchedule(academicContextId, publishedVersion._id);
    return successResponse(res, {
      academicContextId,
      versionId: publishedVersion._id,
      versionLabel: publishedVersion.versionLabel,
      publishedAt: publishedVersion.publishedAt,
      isPublished: true,
      sessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a scheduled session to timetable
 * POST /api/timetable/session
 */
async function createSession(req, res, next) {
  try {
    const {
      timetableVersionId,
      academicContextId,
      courseCode,
      courseName,
      facultyId,
      facultyName,
      day,
      period,
      room,
      sessionType,
      duration,
    } = req.body;

    // Check for hard conflict: same faculty at same day + period
    const facultyConflict = await TimetableSession.findOne({
      timetableVersionId,
      facultyId,
      day,
      period,
    });

    if (facultyConflict) {
      return errorResponse(
        res,
        `Faculty '${facultyId}' is already scheduled on ${day} during ${period}.`,
        409,
        'FACULTY_TIME_CONFLICT'
      );
    }

    const session = await TimetableSession.create({
      timetableVersionId,
      academicContextId: academicContextId || null,
      courseCode: courseCode.toUpperCase().trim(),
      courseName: courseName || '',
      facultyId,
      facultyName: facultyName || '',
      day,
      period,
      room: room || null,
      sessionType: sessionType || 'THEORY',
      duration: duration || 1,
    });

    // Update session count on version
    await TimetableVersion.findByIdAndUpdate(timetableVersionId, {
      $inc: { totalScheduledPeriods: 1 },
    });

    return successResponse(res, session, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a session from timetable
 * DELETE /api/timetable/session/:id
 */
async function deleteSession(req, res, next) {
  try {
    const session = await TimetableSession.findByIdAndDelete(req.params.id);
    if (!session) {
      return errorResponse(res, 'Timetable session not found', 404, 'NOT_FOUND');
    }

    await TimetableVersion.findByIdAndUpdate(session.timetableVersionId, {
      $inc: { totalScheduledPeriods: -1 },
    });

    return successResponse(res, { message: 'Timetable session deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getVersions,
  getVersionById,
  createVersion,
  transitionVersion,
  getFacultyTimetable,
  getClassTimetable,
  getPublishedClassTimetable,
  createSession,
  deleteSession,
};
