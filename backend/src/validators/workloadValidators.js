/**
 * Validation rules for Faculty Workload operations.
 * Shares strict validation constraints for Teaching and Responsibilities.
 */

const {
  validateTeachingPayload,
  validateResponsibilitiesPayload,
} = require('./facultyCreationValidators');

function validateWorkloadPayload(req) {
  const errors = [];
  const body = (req && req.body) ? req.body : req;

  if (!body || typeof body !== 'object') {
    errors.push('Request body must be a valid JSON object');
    return errors;
  }

  const { facultyId, facultyName, designation, teaching, responsibilities } = body;

  if (!facultyId || typeof facultyId !== 'string' || !facultyId.trim()) {
    errors.push('facultyId is required');
  }

  if (!facultyName || typeof facultyName !== 'string' || !facultyName.trim()) {
    errors.push('facultyName is required');
  }

  if (!designation || typeof designation !== 'string' || !designation.trim()) {
    errors.push('designation is required');
  }

  errors.push(...validateTeachingPayload(teaching));
  errors.push(...validateResponsibilitiesPayload(responsibilities));

  return errors;
}

function validateWorkloadUpdatePayload(req) {
  const errors = [];
  const body = (req && req.body) ? req.body : req;

  if (!body || typeof body !== 'object') {
    errors.push('Request body must be a valid JSON object');
    return errors;
  }

  if (body.teaching !== undefined) {
    errors.push(...validateTeachingPayload(body.teaching));
  }

  if (body.responsibilities !== undefined) {
    errors.push(...validateResponsibilitiesPayload(body.responsibilities));
  }

  return errors;
}

module.exports = {
  validateWorkloadPayload,
  validateWorkloadUpdatePayload,
};
