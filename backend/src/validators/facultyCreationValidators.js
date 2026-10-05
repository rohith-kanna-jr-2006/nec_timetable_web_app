/**
 * Faculty Creation & Workload Allocation Payload Validator
 *
 * Enforces strict backend validation rules:
 * - Basic faculty information (facultyName, designation)
 * - Structured teaching allocations:
 *     - UG Theory (ugTheory1, ugTheory2): courseName required, hours >= 0
 *     - Labs (lab1, lab2): courseName required, hours >= 0
 *     - PG / Honours / Minor: courseName required, each assigned course = 1 equivalent hour/week
 *     - Others: courseName required, hours strictly 1–3 hours/week (reject < 1 and > 3)
 * - Structured responsibilities:
 *     - Must NOT be free-text
 *     - Must match the authoritative 38 institutional responsibility master
 *     - Hours strictly 1–6 hours/week (reject < 1 and > 6)
 *     - Duplicate responsibilities for the same faculty rejected
 */

const {
  isValidResponsibilityRole,
  RESPONSIBILITY_MASTER_ROLES,
} = require('../constants/responsibilityMaster');
const { parseDateOfBirth } = require('../utils/facultyCredentials');

/**
 * Phase 9: the complete set of mutable Faculty Information fields.
 * Everything else is protected and must never be written through the faculty
 * edit endpoint (PUT /api/faculty/:facultyId).
 */
const FACULTY_EDITABLE_FIELDS = Object.freeze([
  'facultyName',
  'email',
  'dateOfBirth',
  'designation',
  'phone',
]);

/**
 * Phase 9: fields a caller may never write through the faculty edit endpoint.
 *
 * Rejection is explicit rather than silent, because silently dropping a protected
 * field would hide an attempted privilege escalation from the caller.
 */
const FACULTY_PROTECTED_FIELDS = Object.freeze([
  'facultyId',
  'role',
  'roles',
  'department',
  'password',
  'passwordHash',
  'isActive',
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'workload',
  'workloadCalculation',
  'teaching',
  'responsibilities',
  'allocations',
  'calculatedTotalHours',
  'calculatedTeachingHours',
  'calculatedResponsibilityHours',
  'sourceTotalHours',
  'teachingLoad',
  'summary',
]);

/**
 * Builds the explicit update payload from an untrusted request body.
 * Throws a structured error when a protected field is present.
 */
function buildFacultyUpdatePayload(body) {
  const source = body && typeof body === 'object' ? body : {};

  const attempted = FACULTY_PROTECTED_FIELDS.filter((f) =>
    Object.prototype.hasOwnProperty.call(source, f)
  );
  if (attempted.length > 0) {
    const err = new Error(
      `Protected field(s) cannot be updated through the faculty edit endpoint: ${attempted.join(', ')}`
    );
    err.name = 'FacultyUpdateError';
    err.code = 'PROTECTED_FIELD';
    err.statusCode = 400;
    err.details = { attempted, allowed: FACULTY_EDITABLE_FIELDS };
    throw err;
  }

  const unknown = Object.keys(source).filter((k) => !FACULTY_EDITABLE_FIELDS.includes(k));
  if (unknown.length > 0) {
    const err = new Error(
      `Field(s) not permitted in a faculty update: ${unknown.join(', ')}. Allowed: ${FACULTY_EDITABLE_FIELDS.join(', ')}`
    );
    err.name = 'FacultyUpdateError';
    err.code = 'PROTECTED_FIELD';
    err.statusCode = 400;
    err.details = { attempted: unknown, allowed: FACULTY_EDITABLE_FIELDS };
    throw err;
  }

  const update = {};
  FACULTY_EDITABLE_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(source, field)) return;
    let value = source[field];

    if (field === 'dateOfBirth') {
      if (value === null || value === '') {
        update.dateOfBirth = null;
      } else {
        const parts = parseDateOfBirth(value);
        if (!parts) {
          const err = new Error('dateOfBirth must be a real calendar date in YYYY-MM-DD format');
          err.name = 'FacultyUpdateError';
          err.code = 'INVALID_DATE_OF_BIRTH';
          err.statusCode = 400;
          err.details = { dateOfBirth: value };
          throw err;
        }
        update.dateOfBirth = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
      }
      return;
    }

    if (typeof value === 'string') value = value.trim();
    update[field] = value;
  });

  return update;
}

/**
 * Validates the teaching allocation object across all categories.
 */
function validateTeachingPayload(teaching) {
  const errors = [];
  if (teaching === undefined || teaching === null) return errors;

  if (typeof teaching !== 'object' || Array.isArray(teaching)) {
    errors.push('teaching must be an object containing allocation categories');
    return errors;
  }

  const allowedCategories = ['ugTheory1', 'ugTheory2', 'lab1', 'lab2', 'pg', 'others'];
  const extraCategories = Object.keys(teaching).filter((k) => !allowedCategories.includes(k));
  if (extraCategories.length > 0) {
    errors.push(`Invalid teaching category: ${extraCategories.join(', ')}. Allowed categories: ${allowedCategories.join(', ')}`);
  }

  // UG Theory 1 & 2
  ['ugTheory1', 'ugTheory2'].forEach((catKey) => {
    const items = teaching[catKey];
    if (items !== undefined && items !== null) {
      if (!Array.isArray(items)) {
        errors.push(`teaching.${catKey} must be an array`);
      } else {
        items.forEach((item, idx) => {
          const label = `${catKey}[${idx + 1}]`;
          if (!item || typeof item !== 'object') {
            errors.push(`${label} must be a valid allocation object`);
            return;
          }
          if (!item.courseName || typeof item.courseName !== 'string' || !item.courseName.trim()) {
            errors.push(`Missing courseName in ${label}`);
          }
          if (item.hours !== undefined && item.hours !== null) {
            if (typeof item.hours !== 'number' || isNaN(item.hours) || item.hours < 0) {
              errors.push(`Invalid hours in ${label}. Must be a non-negative number.`);
            }
          }
        });
      }
    }
  });

  // Labs 1 & 2
  ['lab1', 'lab2'].forEach((catKey) => {
    const items = teaching[catKey];
    if (items !== undefined && items !== null) {
      if (!Array.isArray(items)) {
        errors.push(`teaching.${catKey} must be an array`);
      } else {
        items.forEach((item, idx) => {
          const label = `${catKey}[${idx + 1}]`;
          if (!item || typeof item !== 'object') {
            errors.push(`${label} must be a valid allocation object`);
            return;
          }
          if (!item.courseName || typeof item.courseName !== 'string' || !item.courseName.trim()) {
            errors.push(`Missing courseName in ${label}`);
          }
          if (item.hours !== undefined && item.hours !== null) {
            if (typeof item.hours !== 'number' || isNaN(item.hours) || item.hours < 0) {
              errors.push(`Invalid hours in ${label}. Must be a non-negative number.`);
            }
          }
        });
      }
    }
  });

  // PG / Honours / Minor: each assigned course = 1 equivalent hour/week
  if (teaching.pg !== undefined && teaching.pg !== null) {
    if (!Array.isArray(teaching.pg)) {
      errors.push('teaching.pg must be an array');
    } else {
      teaching.pg.forEach((item, idx) => {
        const label = `PG course row ${idx + 1}`;
        if (!item || typeof item !== 'object') {
          errors.push(`${label} must be a valid allocation object`);
          return;
        }
        if (!item.courseName || typeof item.courseName !== 'string' || !item.courseName.trim()) {
          errors.push(`Missing courseName in ${label}`);
        }
        if (item.hours !== undefined && item.hours !== null) {
          if (typeof item.hours !== 'number' || isNaN(item.hours) || item.hours !== 1) {
            errors.push(`PG / Honours / Minor course hours must be 1 equivalent hour/week (received ${item.hours} in ${label})`);
          }
        }
      });
    }
  }

  // Others: 1–3 hours/week (strictly reject < 1 and > 3)
  if (teaching.others !== undefined && teaching.others !== null) {
    if (!Array.isArray(teaching.others)) {
      errors.push('teaching.others must be an array');
    } else {
      teaching.others.forEach((item, idx) => {
        const label = `Others row ${idx + 1}`;
        if (!item || typeof item !== 'object') {
          errors.push(`${label} must be a valid allocation object`);
          return;
        }
        if (!item.courseName || typeof item.courseName !== 'string' || !item.courseName.trim()) {
          errors.push(`Missing courseName in ${label}`);
        }
        if (item.hours === undefined || item.hours === null || typeof item.hours !== 'number' || isNaN(item.hours)) {
          errors.push(`Others contact hours must be specified as a number between 1 and 3 hours/week in ${label}`);
        } else if (item.hours < 1) {
          errors.push(`Others contact hours must be between 1 and 3 hours/week (received ${item.hours} in ${label}). Hours below 1 are rejected.`);
        } else if (item.hours > 3) {
          errors.push(`Others contact hours must be between 1 and 3 hours/week (received ${item.hours} in ${label}). Hours above 3 are rejected.`);
        }
      });
    }
  }

  return errors;
}

/**
 * Validates the responsibilities array:
 * - Must NOT be free-text string
 * - Must match authoritative 38 institutional roles
 * - Hours strictly 1–6 hours/week (reject < 1 and > 6)
 * - Duplicate responsibilities rejected
 */
function validateResponsibilitiesPayload(responsibilities) {
  const errors = [];
  if (responsibilities === undefined || responsibilities === null) return errors;

  if (typeof responsibilities === 'string') {
    errors.push('Responsibilities must be structured data and cannot be a free-text string.');
    return errors;
  }

  if (!Array.isArray(responsibilities)) {
    errors.push('responsibilities must be an array of structured responsibility objects');
    return errors;
  }

  const seenRoles = new Set();

  responsibilities.forEach((resp, idx) => {
    const label = `Responsibility row ${idx + 1}`;
    if (!resp || typeof resp !== 'object') {
      errors.push(`${label} must be a valid responsibility object with 'role' and 'hours'`);
      return;
    }

    if (!resp.role || typeof resp.role !== 'string' || !resp.role.trim()) {
      errors.push(`Missing role in ${label}`);
      return;
    }

    const roleTrimmed = resp.role.trim();
    const roleNormalized = roleTrimmed.toLowerCase();

    // Exact Master Role Verification
    if (!isValidResponsibilityRole(roleTrimmed)) {
      errors.push(
        `Invalid responsibility role '${roleTrimmed}' in ${label}. Must match one of the authoritative 38 institutional responsibility roles.`
      );
    }

    // Duplicate Check
    if (seenRoles.has(roleNormalized)) {
      errors.push(
        `Duplicate responsibility '${roleTrimmed}' rejected. A responsibility cannot be assigned multiple times to the same faculty member.`
      );
    } else {
      seenRoles.add(roleNormalized);
    }

    // Hours Verification (1–6 hours/week, strictly reject < 1 and > 6)
    if (resp.hours === undefined || resp.hours === null || typeof resp.hours !== 'number' || isNaN(resp.hours)) {
      errors.push(`Responsibility hours must be specified as a number between 1 and 6 hours/week in ${label}`);
    } else if (resp.hours < 1) {
      errors.push(`Responsibility hours must be between 1 and 6 hours/week (received ${resp.hours} in ${label}). Hours below 1 are rejected.`);
    } else if (resp.hours > 6) {
      errors.push(`Responsibility hours must be between 1 and 6 hours/week (received ${resp.hours} in ${label}). Hours above 6 are rejected.`);
    }
  });

  return errors;
}

/**
 * Validates an optional date of birth.
 *
 * Absent is valid (legacy faculty records have no DOB and none is invented).
 * When present the value must be a real calendar date that is not in the future.
 */
function validateDateOfBirth(value, { required = false } = {}) {
  const errors = [];

  if (value === undefined || value === null || value === '') {
    if (required) errors.push('dateOfBirth is required');
    return errors;
  }

  const parts = parseDateOfBirth(value);
  if (!parts) {
    errors.push('dateOfBirth must be a real calendar date in YYYY-MM-DD format');
    return errors;
  }

  const today = new Date();
  const todayUtcMidnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dobUtcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day);
  if (dobUtcMidnight > todayUtcMidnight) {
    errors.push('dateOfBirth cannot be in the future');
  }

  return errors;
}

/**
 * Main validator for Faculty Creation and Workload payload.
 */
function validateFacultyCreationPayload(req) {
  const errors = [];
  const body = (req && req.body) ? req.body : req;

  if (!body || typeof body !== 'object') {
    errors.push('Request body must be a valid JSON object');
    return errors;
  }

  // 1. Faculty Basic Information
  if (!body.facultyName || typeof body.facultyName !== 'string' || !body.facultyName.trim()) {
    errors.push('facultyName is required and must be a non-empty string');
  }

  if (!body.designation || typeof body.designation !== 'string' || !body.designation.trim()) {
    errors.push('designation is required and must be a non-empty string');
  }

  if (body.department !== undefined && (typeof body.department !== 'string' || !body.department.trim())) {
    errors.push('department must be a valid string if provided');
  }

  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      errors.push('email must be a valid email address');
    }
  }

  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    if (typeof body.phone !== 'string' || !body.phone.trim()) {
      errors.push('phone must be a valid string if provided');
    }
  }

  // Phase 9: date of birth.
  errors.push(...validateDateOfBirth(body.dateOfBirth));

  // 2. Teaching Validation (supports nested teaching or flat allocation properties)
  let teachingToValidate = body.teaching;
  if (teachingToValidate === undefined) {
    if (
      body.ugTheory1 !== undefined ||
      body.ugTheory2 !== undefined ||
      body.lab1 !== undefined ||
      body.lab2 !== undefined ||
      body.pg !== undefined ||
      body.others !== undefined
    ) {
      teachingToValidate = {
        ugTheory1: body.ugTheory1,
        ugTheory2: body.ugTheory2,
        lab1: body.lab1,
        lab2: body.lab2,
        pg: body.pg,
        others: body.others,
      };
    }
  }
  errors.push(...validateTeachingPayload(teachingToValidate));

  // 3. Responsibilities Validation
  errors.push(...validateResponsibilitiesPayload(body.responsibilities));

  return errors;
}

module.exports = {
  validateFacultyCreationPayload,
  validateTeachingPayload,
  validateResponsibilitiesPayload,
  validateDateOfBirth,
  buildFacultyUpdatePayload,
  FACULTY_EDITABLE_FIELDS,
  FACULTY_PROTECTED_FIELDS,
};
