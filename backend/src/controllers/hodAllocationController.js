const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const { updateAllocationStatus } = require('../services/allocationService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get HOD faculty allocations
 * GET /api/hod-allocations
 */
async function getAllocations(req, res, next) {
  try {
    const { academicContextId, facultyId, courseCode, status } = req.query;
    const query = {};

    if (academicContextId) query.academicContextId = academicContextId;
    if (facultyId) query.facultyId = facultyId;
    if (courseCode) query.courseCode = courseCode.toUpperCase().trim();
    if (status) query.status = status;

    const allocations = await HODFacultyAllocation.find(query)
      .populate('academicContextId')
      .sort({ createdAt: -1 });

    return successResponse(res, allocations);
  } catch (error) {
    next(error);
  }
}

/**
 * Create an allocation (draft or submitted)
 * POST /api/hod-allocations
 */
async function createAllocation(req, res, next) {
  try {
    const { academicContextId, courseCode, courseName, facultyId, facultyName, allocationType, status } = req.body;

    // Default status is DRAFT if created by AC, or SUBMITTED
    const initialStatus = status || (req.user && req.user.role === 'HOD' ? 'APPROVED' : 'DRAFT');

    // If an AC tries to create with APPROVED, reject
    if (initialStatus === 'APPROVED' && (!req.user || !['HOD', 'ADMIN'].includes(req.user.role))) {
      return errorResponse(
        res,
        'Academic Coordinator cannot create or approve final HOD allocations. Final approval is reserved for HOD.',
        403,
        'FORBIDDEN'
      );
    }

    const allocation = await HODFacultyAllocation.create({
      academicContextId,
      courseCode: courseCode.toUpperCase().trim(),
      courseName: courseName || '',
      facultyId,
      facultyName: facultyName || '',
      allocationType: allocationType || 'THEORY',
      assignedBy: req.user ? req.user.name || req.user.email : 'HOD',
      status: initialStatus,
    });

    return successResponse(res, allocation, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update allocation status (Approve, Reject, Submit)
 * PATCH /api/hod-allocations/:id/status
 */
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!status) {
      return errorResponse(res, 'Target status is required', 400, 'BAD_REQUEST');
    }

    const userRole = req.user ? req.user.role : 'GUEST';

    const updated = await updateAllocationStatus(id, status, userRole, rejectionReason);
    return successResponse(res, updated);
  } catch (error) {
    if (error.message.includes('Only HOD has the authority')) {
      return errorResponse(res, error.message, 403, 'FORBIDDEN');
    }
    next(error);
  }
}

/**
 * Delete an allocation
 * DELETE /api/hod-allocations/:id
 */
async function deleteAllocation(req, res, next) {
  try {
    const allocation = await HODFacultyAllocation.findByIdAndDelete(req.params.id);
    if (!allocation) {
      return errorResponse(res, 'Allocation not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, { message: 'Allocation deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllocations,
  createAllocation,
  updateStatus,
  deleteAllocation,
};
