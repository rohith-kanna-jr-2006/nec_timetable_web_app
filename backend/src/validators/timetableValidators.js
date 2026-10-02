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

/**
 * Validates the Phase 4 generation request body.
 *
 * Every field is optional except academicContextId.  The client may send a
 * TC-designed assignmentPlan, but it is never trusted: the server always
 * re-derives course list, faculty and period counts from HOD allocations.
 */
function validateGenerateFromContext(req) {
  const errors = [];
  const {
    academicContextId,
    timetableVersionId,
    assignmentPlan,
    generationSeed,
    options,
  } = req.body || {};

  // A malformed id throws a Mongoose CastError deep inside the service layer.
  // Reject it here so the caller gets a clear 400 instead of a database error.
  const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

  if (!academicContextId || typeof academicContextId !== 'string' || !academicContextId.trim()) {
    errors.push('academicContextId is required and must be a non-empty string');
  } else if (!OBJECT_ID_PATTERN.test(academicContextId.trim())) {
    errors.push('academicContextId must be a valid 24-character ObjectId');
  }

  if (
    timetableVersionId !== undefined &&
    timetableVersionId !== null &&
    (typeof timetableVersionId !== 'string' || !timetableVersionId.trim())
  ) {
    errors.push('timetableVersionId must be a non-empty string when provided');
  } else if (typeof timetableVersionId === 'string' && timetableVersionId.trim()) {
    if (!OBJECT_ID_PATTERN.test(timetableVersionId.trim())) {
      errors.push('timetableVersionId must be a valid 24-character ObjectId when provided');
    }
  }

  if (assignmentPlan !== undefined && assignmentPlan !== null) {
    if (!Array.isArray(assignmentPlan)) {
      errors.push('assignmentPlan must be an array when provided');
    } else {
      assignmentPlan.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`assignmentPlan[${index}] must be an object`);
          return;
        }
        if (!item.courseCode || typeof item.courseCode !== 'string' || !item.courseCode.trim()) {
          errors.push(`assignmentPlan[${index}].courseCode is required and must be a string`);
        }
        if (item.facultyId !== undefined && typeof item.facultyId !== 'string') {
          errors.push(`assignmentPlan[${index}].facultyId must be a string when provided`);
        }
        if (item.requiredPeriods !== undefined) {
          if (!Number.isInteger(item.requiredPeriods) || item.requiredPeriods < 0) {
            errors.push(`assignmentPlan[${index}].requiredPeriods must be a non-negative integer`);
          }
        }
      });
    }
  }

  if (generationSeed !== undefined && generationSeed !== null) {
    if (typeof generationSeed !== 'number' || !Number.isFinite(generationSeed)) {
      errors.push('generationSeed must be a finite number when provided');
    }
  }

  if (options !== undefined && options !== null) {
    if (typeof options !== 'object' || Array.isArray(options)) {
      errors.push('options must be an object when provided');
    }
  }

  return errors;
}

module.exports = {
  validateTimetableVersion,
  validateTimetableSession,
  validateGenerateFromContext,
};
