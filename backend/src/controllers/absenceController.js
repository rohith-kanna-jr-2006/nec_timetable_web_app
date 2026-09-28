const FacultyAbsence = require('../models/FacultyAbsence');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get faculty absences
 * GET /api/absences
 */
async function getAbsences(req, res, next) {
  try {
    const { facultyId, date, status } = req.query;
    const query = {};

    if (facultyId) query.facultyId = facultyId;
    if (date) query.date = date;
    if (status) query.status = status;

    const absences = await FacultyAbsence.find(query).sort({ date: -1 });
    return successResponse(res, absences);
  } catch (error) {
    next(error);
  }
}

/**
 * Report an absence / leave
 * POST /api/absences
 */
async function reportAbsence(req, res, next) {
  try {
    const { facultyId, date, reason } = req.body;

    const absence = await FacultyAbsence.create({
      facultyId,
      date,
      reason,
      status: 'PENDING',
      reportedBy: req.user ? req.user.name || req.user.email : 'Faculty',
    });

    return successResponse(res, absence, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update absence status (HOD approve/reject)
 * PATCH /api/absences/:id/status
 */
async function updateAbsenceStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return errorResponse(res, 'Status must be APPROVED or REJECTED', 400, 'BAD_REQUEST');
    }

    const absence = await FacultyAbsence.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvedBy: req.user ? req.user.name || req.user.email : 'HOD',
      },
      { new: true }
    );

    if (!absence) {
      return errorResponse(res, 'Absence record not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, absence);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAbsences,
  reportAbsence,
  updateAbsenceStatus,
};
