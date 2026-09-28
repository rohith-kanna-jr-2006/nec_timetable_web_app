const FacultyAvailability = require('../models/FacultyAvailability');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get faculty availability entries
 * GET /api/availability
 */
async function getAvailability(req, res, next) {
  try {
    const { facultyId, day, status } = req.query;
    const query = {};

    if (facultyId) query.facultyId = facultyId;
    if (day) query.day = day;
    if (status) query.status = status;

    const records = await FacultyAvailability.find(query).sort({ day: 1, period: 1 });
    return successResponse(res, records);
  } catch (error) {
    next(error);
  }
}

/**
 * Set faculty availability entry
 * POST /api/availability
 */
async function setAvailability(req, res, next) {
  try {
    const { facultyId, academicContextId, day, period, status, reason } = req.body;

    const record = await FacultyAvailability.findOneAndUpdate(
      { facultyId, day, period },
      {
        facultyId,
        academicContextId: academicContextId || null,
        day,
        period,
        status: status || 'UNAVAILABLE',
        reason: reason || null,
      },
      { new: true, upsert: true, runValidators: true }
    );

    return successResponse(res, record, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete availability entry
 * DELETE /api/availability/:id
 */
async function deleteAvailability(req, res, next) {
  try {
    const record = await FacultyAvailability.findByIdAndDelete(req.params.id);
    if (!record) {
      return errorResponse(res, 'Availability record not found', 404, 'NOT_FOUND');
    }
    return successResponse(res, { message: 'Availability record deleted' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAvailability,
  setAvailability,
  deleteAvailability,
};
