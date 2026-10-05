/**
 * Validation rules for Allocation & Advisor Assignment.
 */

function validateHodAllocation(req) {
  const errors = [];
  const { academicContextId, courseCode, facultyId, allocationType } = req.body || {};

  if (!academicContextId) {
    errors.push('academicContextId is required');
  }

  if (!courseCode || typeof courseCode !== 'string' || !courseCode.trim()) {
    errors.push('courseCode is required');
  }

  const hasAssignments = Array.isArray(req.body?.facultyAssignments) && req.body.facultyAssignments.length > 0;

  if (!hasAssignments && (!facultyId || typeof facultyId !== 'string' || !facultyId.trim())) {
    errors.push('facultyId or facultyAssignments is required');
  }

  if (allocationType && !['THEORY', 'LAB_PRIMARY', 'LAB_ADDITIONAL', 'SAS', 'OTHERS'].includes(allocationType)) {
    errors.push('Invalid allocationType');
  }

  return errors;
}

function validateClassAdvisor(req) {
  const errors = [];
  const { academicContextId, facultyId } = req.body || {};

  if (!academicContextId) {
    errors.push('academicContextId is required');
  } else if (!/^[a-fA-F0-9]{24}$/.test(String(academicContextId))) {
    // Phase 8: a class advisor is scoped to an exact AcademicContext, so a
    // malformed id must be refused here instead of reaching the service.
    errors.push('academicContextId must be a valid ObjectId');
  }

  if (!facultyId || typeof facultyId !== 'string' || !facultyId.trim()) {
    errors.push('facultyId is required');
  }

  return errors;
}

module.exports = {
  validateHodAllocation,
  validateClassAdvisor,
};
