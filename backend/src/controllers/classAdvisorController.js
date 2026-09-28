const ClassAdvisorAssignment = require('../models/ClassAdvisorAssignment');
const { assignClassAdvisor } = require('../services/allocationService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get all class advisor assignments
 * GET /api/class-advisors
 */
async function getAdvisors(req, res, next) {
  try {
    const { academicContextId, facultyId, status } = req.query;
    const query = {};

    if (academicContextId) query.academicContextId = academicContextId;
    if (facultyId) query.facultyId = facultyId;
    if (status) query.status = status;

    const assignments = await ClassAdvisorAssignment.find(query)
      .populate('academicContextId')
      .sort({ assignedAt: -1 });

    return successResponse(res, assignments);
  } catch (error) {
    next(error);
  }
}

/**
 * Assign class advisor (HOD Authority)
 * POST /api/class-advisors
 */
async function assignAdvisor(req, res, next) {
  try {
    const { academicContextId, facultyId } = req.body;
    const assignedBy = req.user ? req.user.name || req.user.email : 'HOD';

    const assignment = await assignClassAdvisor({
      academicContextId,
      facultyId,
      assignedBy,
    });

    return successResponse(res, assignment, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Deactivate class advisor assignment
 * PATCH /api/class-advisors/:id/deactivate
 */
async function deactivateAdvisor(req, res, next) {
  try {
    const assignment = await ClassAdvisorAssignment.findByIdAndUpdate(
      req.params.id,
      { status: 'INACTIVE' },
      { new: true }
    );

    if (!assignment) {
      return errorResponse(res, 'Class advisor assignment not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, assignment);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdvisors,
  assignAdvisor,
  deactivateAdvisor,
};
