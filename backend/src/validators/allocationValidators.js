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

  if (!facultyId || typeof facultyId !== 'string' || !facultyId.trim()) {
    errors.push('facultyId is required');
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
