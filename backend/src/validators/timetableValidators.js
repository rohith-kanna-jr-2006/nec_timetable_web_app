/**
 * Validation rules for Timetable Version and Timetable Session.
 */

function validateTimetableVersion(req) {
  const errors = [];
  const { academicYear, semester, department } = req.body || {};

  if (!academicYear || typeof academicYear !== 'string' || !academicYear.trim()) {
    errors.push('academicYear is required');
  }

  if (!semester || typeof semester !== 'string' || !semester.trim()) {
    errors.push('semester is required');
  }

  if (!department || typeof department !== 'string' || !department.trim()) {
    errors.push('department is required');
  }

  return errors;
}

function validateTimetableSession(req) {
  const errors = [];
  const { timetableVersionId, courseCode, facultyId, day, period } = req.body || {};

  if (!timetableVersionId) {
    errors.push('timetableVersionId is required');
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
