const SubstituteAllocation = require('../models/SubstituteAllocation');
const AcademicContext = require('../models/AcademicContext');
const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');
const FacultyAbsence = require('../models/FacultyAbsence');
const {
  resolveAffectedSessions,
  buildAffectedSessionPayload,
  findEligibleSubstitutes,
  createSubstituteMapping,
} = require('../services/substituteMappingService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get substitute allocations
 * GET /api/substitutes
 */
async function getSubstitutes(req, res, next) {
  try {
    const { absenceId, originalFacultyId, substituteFacultyId, date, status } = req.query;
    const query = {};

    if (absenceId) query.absenceId = absenceId;
    if (originalFacultyId) query.originalFacultyId = originalFacultyId;
    if (substituteFacultyId) query.substituteFacultyId = substituteFacultyId;
    if (date) query.date = date;
    if (status) query.status = status;

    const substitutes = await SubstituteAllocation.find(query)
      .populate('absenceId')
      .populate('timetableSessionId')
      .sort({ date: -1 });

    return successResponse(res, substitutes);
  } catch (error) {
    next(error);
  }
}

/**
 * Assign substitute teacher
 * POST /api/substitutes
 *
 * Phase 7: the request is validated server-side against the absence, the exact
 * affected TimetableSession and the substitute's availability for that slot.
 * The backend derives every value it already knows instead of trusting the body.
 */
async function assignSubstitute(req, res, next) {
  try {
    const {
      absenceId,
      originalFacultyId,
      substituteFacultyId,
      timetableSessionId,
      date,
      period,
      academicContextId,
      timetableVersionId,
      status,
    } = req.body || {};

    const { mapping, session } = await createSubstituteMapping({
      absenceId,
      originalFacultyId,
      substituteFacultyId,
      timetableSessionId,
      date,
      period,
      academicContextId,
      timetableVersionId,
      status: ['PENDING', 'ACCEPTED'].includes(status) ? status : 'PENDING',
      assignedBy: req.user ? req.user.name || req.user.email : 'TC',
    });

    return successResponse(res, mapping, 201, {
      resolvedSession: session ? buildAffectedSessionPayload(session) : null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Phase 7: resolve the exact timetable sessions affected by an absence.
 * GET /api/substitutes/affected-sessions
 *
 * Query: absenceId (or facultyId + date + period), academicContextId?, timetableVersionId?
 */
async function getAffectedSessions(req, res, next) {
  try {
    const { absenceId, facultyId, date, period, academicContextId, timetableVersionId } = req.query;

    let resolvedAbsence = null;
    let effectiveFacultyId = facultyId;
    let effectiveDate = date;
    let effectivePeriod = period;

    if (absenceId) {
      resolvedAbsence = await FacultyAbsence.findById(absenceId);
      if (!resolvedAbsence) {
        return errorResponse(res, 'Absence record not found', 404, 'ABSENCE_NOT_FOUND', { absenceId });
      }
      // The absence record is authoritative for faculty and date.
      effectiveFacultyId = resolvedAbsence.facultyId;
      effectiveDate = resolvedAbsence.date;
    }

    const resolved = await resolveAffectedSessions({
      academicContextId: academicContextId || (resolvedAbsence && resolvedAbsence.academicContextId) || null,
      timetableVersionId: timetableVersionId || null,
      facultyId: effectiveFacultyId,
      date: effectiveDate,
      period: effectivePeriod,
    });

    const first = resolved.sessions[0];
    const [context, version] = await Promise.all([
      first && first.academicContextId ? AcademicContext.findById(first.academicContextId).lean() : null,
      first ? TimetableVersion.findById(first.timetableVersionId).lean() : null,
    ]);

    const affected = resolved.sessions.map((session) =>
      buildAffectedSessionPayload(session, { absence: resolvedAbsence, context, version })
    );

    return successResponse(res, {
      date: effectiveDate,
      day: resolved.day,
      period: effectivePeriod || null,
      facultyId: effectiveFacultyId || null,
      sessionCount: affected.length,
      // Named explicitly so a client can act on a genuine multi-session absence
      // instead of silently receiving an arbitrary session.
      ambiguity: resolved.ambiguity,
      sessions: affected,
    });
  } catch (error) {
    next(error);
  }
}
/**
 * Phase 7: server-side eligible substitute faculty for an exact slot.
 * GET /api/substitutes/eligible-faculty
 *
 * Query: timetableSessionId, absenceId?, academicContextId?, timetableVersionId?
 *
 * Returns only faculty that pass every backend constraint for that slot; the
 * frontend never has to decide who is free.
 */
async function getEligibleFaculty(req, res, next) {
  try {
    const { timetableSessionId, absenceId, academicContextId, timetableVersionId } = req.query;

    if (!timetableSessionId) {
      return errorResponse(res, 'timetableSessionId is required', 400, 'SESSION_REQUIRED', {});
    }

    const session = await TimetableSession.findById(timetableSessionId).lean();
    if (!session) {
      return errorResponse(res, 'Timetable session not found', 404, 'SESSION_NOT_FOUND', { timetableSessionId });
    }

    let absence = null;
    if (absenceId) {
      absence = await FacultyAbsence.findById(absenceId).lean();
      if (!absence) {
        return errorResponse(res, 'Absence record not found', 404, 'ABSENCE_NOT_FOUND', { absenceId });
      }
    }

    // Cross-context guard: never offer substitutes computed against another context.
    if (academicContextId && session.academicContextId && String(session.academicContextId) !== String(academicContextId)) {
      return errorResponse(
        res,
        'The timetable session belongs to a different academic context.',
        409,
        'SESSION_CONTEXT_MISMATCH',
        { sessionContextId: String(session.academicContextId), requestedContextId: String(academicContextId) }
      );
    }

    // The absence date is authoritative; without one there is no slot to evaluate.
    const date = absence ? absence.date : req.query.date;
    if (!date) {
      return errorResponse(
        res,
        'absenceId or date is required to evaluate substitute eligibility.',
        400,
        'DATE_REQUIRED',
        {}
      );
    }

    const eligible = await findEligibleSubstitutes({
      academicContextId: academicContextId || session.academicContextId || null,
      timetableVersionId: timetableVersionId || session.timetableVersionId || null,
      session,
      date,
      period: session.period,
      excludeFacultyId: absence ? absence.facultyId : session.facultyId,
    });

    return successResponse(res, {
      timetableSessionId: session._id,
      absenceId: absence ? absence._id : null,
      date,
      day: session.day,
      period: session.period,
      eligibleCount: eligible.length,
      eligibleFaculty: eligible,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update substitute status (Accept / Reject)
 * PATCH /api/substitutes/:id/status
 */
async function updateSubstituteStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return errorResponse(res, 'Invalid substitute status', 400, 'BAD_REQUEST');
    }

    const substitute = await SubstituteAllocation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!substitute) {
      return errorResponse(res, 'Substitute allocation not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, substitute);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSubstitutes,
  assignSubstitute,
  getAffectedSessions,
  getEligibleFaculty,
  updateSubstituteStatus,
};
