const SubstituteAllocation = require('../models/SubstituteAllocation');
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
 */
async function assignSubstitute(req, res, next) {
  try {
    const { absenceId, originalFacultyId, substituteFacultyId, timetableSessionId, date, period } = req.body;

    const substitute = await SubstituteAllocation.create({
      absenceId,
      originalFacultyId,
      substituteFacultyId,
      timetableSessionId,
      date,
      period,
      status: 'PENDING',
      assignedBy: req.user ? req.user.name || req.user.email : 'HOD',
    });

    return successResponse(res, substitute, 201);
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
  updateSubstituteStatus,
};
