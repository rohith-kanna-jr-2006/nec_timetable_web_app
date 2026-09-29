const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
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
      .sort({ createdAt: -1 })
      .lean();

    const formatted = allocations.map((a) => {
      const ctx = a.academicContextId;
      const ctxIdStr = ctx && ctx._id ? ctx._id.toString() : (a.academicContextId ? a.academicContextId.toString() : null);
      return {
        ...a,
        academicContext: ctx,
        academicContextId: ctxIdStr || a.academicContextId,
      };
    });

    return successResponse(res, formatted);
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

    const normalizedCourseCode = courseCode.toUpperCase().trim();

    // Check if an active authoritative allocation already exists for this context + course
    const existing = await HODFacultyAllocation.findOne({
      academicContextId,
      courseCode: normalizedCourseCode,
      status: { $ne: 'REJECTED' },
    });

    if (existing) {
      return errorResponse(
        res,
        `An active HOD allocation already exists for course '${normalizedCourseCode}' in this academic context. HOD resolution is required.`,
        409,
        'HOD_ALLOCATION_CONFLICT'
      );
    }

    // Default status is APPROVED if created by HOD/ADMIN, else DRAFT
    const initialStatus = status || (req.user && ['HOD', 'ADMIN'].includes(req.user.role) ? 'APPROVED' : 'DRAFT');

    // If an unauthorized role attempts to create with APPROVED, reject
    if (initialStatus === 'APPROVED' && (!req.user || !['HOD', 'ADMIN'].includes(req.user.role))) {
      return errorResponse(
        res,
        'Only HOD has the authority to create approved faculty allocations.',
        403,
        'FORBIDDEN'
      );
    }

    // Auto-resolve courseName if missing
    let resolvedCourseName = courseName;
    if (!resolvedCourseName) {
      const crs = await Course.findOne({ courseCode: normalizedCourseCode });
      if (crs) resolvedCourseName = crs.courseName;
    }

    // Auto-resolve facultyName if missing
    let resolvedFacultyName = facultyName;
    if (!resolvedFacultyName) {
      const fac = await Faculty.findOne({ facultyId });
      if (fac) resolvedFacultyName = fac.facultyName;
    }

    const allocation = await HODFacultyAllocation.create({
      academicContextId,
      courseCode: normalizedCourseCode,
      courseName: resolvedCourseName || '',
      facultyId,
      facultyName: resolvedFacultyName || '',
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
 * Update an allocation (e.g. reassign faculty)
 * PUT /api/hod-allocations/:id
 */
async function updateAllocation(req, res, next) {
  try {
    const { id } = req.params;
    const { facultyId, facultyName, allocationType, status } = req.body;

    let resolvedFacultyName = facultyName;
    if (facultyId && !resolvedFacultyName) {
      const fac = await Faculty.findOne({ facultyId });
      if (fac) resolvedFacultyName = fac.facultyName;
    }

    const updateData = {};
    if (facultyId) updateData.facultyId = facultyId;
    if (resolvedFacultyName) updateData.facultyName = resolvedFacultyName;
    if (allocationType) updateData.allocationType = allocationType;
    if (status) updateData.status = status;
    updateData.assignedBy = req.user ? req.user.name || req.user.email : 'HOD';

    const updated = await HODFacultyAllocation.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return errorResponse(res, 'Allocation not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, updated);
  } catch (error) {
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
  updateAllocation,
  updateStatus,
  deleteAllocation,
};
