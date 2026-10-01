/**
 * Validation rules for Timetable Version and Timetable Session.
 */

function validateTimetableVersion(req) {
  const errors = [];
  const { academicContextId, academicYear, semester, department } = req.body || {};

  // Phase 2: academicContextId is the authoritative anchor.
  // If supplied, legacy 5-field strings are optional and will be resolved canonical.
  if (academicContextId) {
    if (typeof academicContextId !== 'string' || !academicContextId.trim()) {
      errors.push('academicContextId must be a valid non-empty string');
    }
  } else {
    if (!academicYear || typeof academicYear !== 'string' || !academicYear.trim()) {
      errors.push('academicYear is required when academicContextId is omitted');
    }

    if (!semester || typeof semester !== 'string' || !semester.trim()) {
      errors.push('semester is required when academicContextId is omitted');
    }

    if (!department || typeof department !== 'string' || !department.trim()) {
      errors.push('department is required when academicContextId is omitted');
    }
  }

  return errors;
}

function validateTimetableSession(req) {
  const errors = [];
  const { timetableVersionId, academicContextId, courseCode, facultyId, day, period } = req.body || {};

  if (!timetableVersionId && !academicContextId) {
    errors.push('academicContextId or timetableVersionId is required');
  }

  if (!courseCode || typeof courseCode !== 'string' || !courseCode.trim()) {
    errors.push('courseCode is required');
  }

  if (!facultyId || typeof facultyId !== 'string' || !facultyId.trim()) {
    errors.push('facultyId is required');
  }

  const validDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  if (!day || !validDays.includes(day)) {
    errors.push(`day must be one of: ${validDays.join(', ')}`);
  }

  if (!period || typeof period !== 'string' || !period.trim()) {
    errors.push('period is required');
  }

  return errors;
}

module.exports = {
  validateTimetableVersion,
  validateTimetableSession,
};
