const ClassAdvisorAssignment = require('../models/ClassAdvisorAssignment');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const AcademicContext = require('../models/AcademicContext');
const Faculty = require('../models/Faculty');

/**
 * Builds a structured error so the controller can map it without string matching.
 * Uses the same convention as the timetable/substitute services.
 */
function _advisorError(message, code, statusCode, details = null) {
  const err = new Error(message);
  err.name = 'ClassAdvisorError';
  err.code = code;
  err.statusCode = statusCode;
  err.details = details;
  return err;
}

/**
 * Ensures no duplicate active class advisor assignment exists for the academic context.
 */
async function assignClassAdvisor({ academicContextId, facultyId, assignedBy }) {
  if (!academicContextId) {
    throw _advisorError('academicContextId is required.', 'ACADEMIC_CONTEXT_REQUIRED', 400, {});
  }

  // Phase 8: the advisor is scoped to an exact AcademicContext, so the context
  // must exist. A cross-context or stale-context identity is refused rather than
  // silently creating an assignment against the wrong cohort.
  const context = await AcademicContext.findById(academicContextId).lean();
  if (!context) {
    throw _advisorError('Academic context not found.', 'CONTEXT_NOT_FOUND', 404, { academicContextId });
  }

  if (!facultyId || !String(facultyId).trim()) {
    throw _advisorError('facultyId is required.', 'FACULTY_REQUIRED', 400, {});
  }

  const faculty = await Faculty.findOne({ facultyId: String(facultyId).trim() }).lean();
  if (!faculty) {
    throw _advisorError('Faculty member not found.', 'FACULTY_NOT_FOUND', 404, { facultyId });
  }
  if (faculty.isActive === false) {
    throw _advisorError('Faculty member is inactive.', 'FACULTY_INACTIVE', 409, { facultyId });
  }

  // Deactivate any existing active advisor for THIS context only. Assignments in
  // other academic years are different AcademicContexts and are left untouched,
  // so an old year's advisor record survives a reassignment in a later year.
  await ClassAdvisorAssignment.updateMany(
    { academicContextId: context._id, status: 'ACTIVE' },
    { status: 'INACTIVE' }
  );

  let newAssignment;
  try {
    newAssignment = await ClassAdvisorAssignment.create({
      academicContextId: context._id,
      facultyId: faculty.facultyId,
      assignedBy,
      assignedAt: new Date(),
      status: 'ACTIVE',
    });
  } catch (err) {
    // Defence in depth for the partial unique index: a concurrent writer must not
    // be able to leave two ACTIVE advisors on one context.
    if (err && err.code === 11000) {
      throw _advisorError(
        'This academic context already has an active class advisor.',
        'DUPLICATE_CLASS_ADVISOR',
        409,
        { academicContextId: context._id }
      );
    }
    throw err;
  }

  return newAssignment;
}

/**
 * Validates and updates HOD Allocation status.
 * Business Rule: AC cannot approve. Only HOD/ADMIN can transition to APPROVED.
 */
async function updateAllocationStatus(allocationId, newStatus, userRole, rejectionReason = null) {
  if (newStatus === 'APPROVED' && !['HOD', 'ADMIN'].includes(userRole)) {
    throw new Error('Only HOD has the authority to approve faculty allocations.');
  }

  const allocation = await HODFacultyAllocation.findById(allocationId);
  if (!allocation) {
    throw new Error('Faculty allocation record not found.');
  }

  allocation.status = newStatus;
  if (newStatus === 'REJECTED') {
    allocation.rejectionReason = rejectionReason || 'Rejected by HOD';
  } else if (newStatus === 'APPROVED') {
    allocation.rejectionReason = null;
  }

  await allocation.save();
  return allocation;
}

module.exports = {
  assignClassAdvisor,
  updateAllocationStatus,
};
