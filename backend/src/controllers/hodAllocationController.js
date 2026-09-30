const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const AcademicContext = require('../models/AcademicContext');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const { updateAllocationStatus } = require('../services/allocationService');
const { resolveSemesterForContext } = require('../services/timetable/semesterResolver');
const { R22_ELECTIVE_SLOT_MAP } = require('../data/r22CurriculumMaster');
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
 * Validate all course allocations for an academic cohort/context
 * GET /api/hod-allocations/validate/:academicContextId
 */
async function validateCohortAllocations(req, res, next) {
  try {
    const { academicContextId } = req.params;

    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
    }

    const expectedSemester = resolveSemesterForContext(context);
    if (!expectedSemester) {
      return errorResponse(res, `Cannot map cohort '${context.year}' (${context.semester}) to an official curriculum semester`, 400, 'INVALID_COHORT_YEAR');
    }

    // Find curriculum courses for this cohort
    const curriculumCourses = await Course.find({
      semester: expectedSemester,
      isActive: true,
      category: { $nin: ['PEC', 'OEC'] }, // Standard core requirements
    }).sort({ courseCode: 1 });

    const allocations = await HODFacultyAllocation.find({
      academicContextId: context._id,
      status: { $ne: 'REJECTED' },
    });

    const allocByCourse = new Map();
    for (const alloc of allocations) {
      if (!allocByCourse.has(alloc.courseCode)) {
        allocByCourse.set(alloc.courseCode, []);
      }
      allocByCourse.get(alloc.courseCode).push(alloc);
    }

    const validationResults = [];
    let allValid = true;

    for (const course of curriculumCourses) {
      const courseAllocs = allocByCourse.get(course.courseCode) || [];
      if (courseAllocs.length === 0) {
        allValid = false;
        validationResults.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          status: 'UNRESOLVED',
          error: `Missing HOD faculty allocation for course ${course.courseCode}`,
        });
      } else if (courseAllocs.length > 1) {
        allValid = false;
        validationResults.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          status: 'CONFLICT',
          error: `Multiple allocations found (${courseAllocs.length}) for course ${course.courseCode}`,
          allocations: courseAllocs,
        });
      } else {
        const alloc = courseAllocs[0];
        const faculty = await Faculty.findOne({ facultyId: alloc.facultyId });
        if (!faculty) {
          allValid = false;
          validationResults.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            status: 'INVALID_FACULTY',
            error: `Allocated faculty ID '${alloc.facultyId}' not found`,
          });
        } else if (!faculty.isActive) {
          allValid = false;
          validationResults.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            status: 'INACTIVE_FACULTY',
            error: `Allocated faculty '${faculty.facultyName}' is inactive`,
          });
        } else {
          validationResults.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            facultyId: faculty.facultyId,
            facultyName: faculty.facultyName,
            status: 'VALID',
          });
        }
      }
    }

    return successResponse(res, {
      academicContextId: context._id,
      cohort: `${context.year} Sec ${context.section} (${expectedSemester})`,
      readyForGeneration: allValid,
      totalRequiredCourses: curriculumCourses.length,
      allocatedCount: validationResults.filter((r) => r.status === 'VALID').length,
      details: validationResults,
    });
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

    // 1. Verify academic context exists and is active
    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, `Academic context '${academicContextId}' not found`, 404, 'NOT_FOUND');
    }
    if (context.status !== 'ACTIVE') {
      return errorResponse(res, `Academic context '${academicContextId}' is not active`, 400, 'CONTEXT_INACTIVE');
    }

    // 2. Verify course exists
    const crs = await Course.findOne({ courseCode: normalizedCourseCode });
    if (!crs) {
      return errorResponse(res, `Course '${normalizedCourseCode}' not found in Course Master`, 404, 'COURSE_NOT_FOUND');
    }

    // Verify course semester matches academic context cohort
    const expectedSemester = resolveSemesterForContext(context);

    if (expectedSemester && crs.semester && crs.semester.startsWith('Semester ')) {
      if (crs.semester.toUpperCase() !== expectedSemester.toUpperCase()) {
        return errorResponse(
          res,
          `Course '${normalizedCourseCode}' belongs to ${crs.semester}, but target cohort is ${context.year} (${expectedSemester}).`,
          409,
          'COURSE_SEMESTER_MISMATCH'
        );
      }
    } else if (
      expectedSemester &&
      (['PEC', 'OEC', 'Management Elective'].includes(crs.electiveType) ||
        ['PEC', 'OEC'].includes(crs.category))
    ) {
      const slotsForSem = R22_ELECTIVE_SLOT_MAP[expectedSemester] || [];
      const allowsPEC = slotsForSem.some((s) => s.allowedType.includes('PEC'));
      const allowsOEC = slotsForSem.some((s) => s.allowedType.includes('OEC'));
      const allowsMgmt = slotsForSem.some((s) => s.allowedType.includes('Management'));

      const isPEC = crs.electiveType === 'PEC' || crs.category === 'PEC';
      const isOEC = crs.electiveType === 'OEC' || crs.category === 'OEC';
      const isMgmt = crs.electiveType === 'Management Elective';

      if ((isPEC && !allowsPEC) || (isOEC && !allowsOEC) || (isMgmt && !allowsMgmt)) {
        return errorResponse(
          res,
          `Elective '${normalizedCourseCode}' (${crs.electiveType || crs.category}) is not permitted for ${context.year} (${expectedSemester}).`,
          409,
          'COURSE_SEMESTER_MISMATCH'
        );
      }
    }

    // 3. Verify faculty exists and is active
    const fac = await Faculty.findOne({ facultyId: facultyId.trim() });
    if (!fac) {
      return errorResponse(res, `Faculty '${facultyId}' not found in Faculty database`, 404, 'FACULTY_NOT_FOUND');
    }
    if (fac.isActive === false) {
      return errorResponse(res, `Faculty '${fac.facultyName}' (${facultyId}) is marked inactive`, 409, 'FACULTY_INACTIVE');
    }

    // 4. Check if an active authoritative allocation already exists for this context + course
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

    const allocation = await HODFacultyAllocation.create({
      academicContextId,
      courseCode: normalizedCourseCode,
      courseName: crs.courseName, // Always enforce canonical courseName from Course Master
      facultyId: fac.facultyId,
      facultyName: fac.facultyName,
      allocationType: allocationType || (crs.isLab ? 'LAB_PRIMARY' : 'THEORY'),
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
  validateCohortAllocations,
  createAllocation,
  updateAllocation,
  updateStatus,
  deleteAllocation,
};

