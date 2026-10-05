const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const { deriveInitialCredential, hashCredential } = require('../utils/facultyCredentials');
const { validateDateOfBirth } = require('../validators/facultyCreationValidators');

/**
 * Create Faculty Master (Phase 9).
 *
 * Identity creation and credential creation are kept separate concepts:
 *
 *   Faculty Master identity -> Faculty record (never holds a credential)
 *   Login account           -> User record  (holds only a bcrypt hash)
 *
 * When a dateOfBirth is supplied the backend derives the initial credential as
 * DDMMYYYY, hashes it with the project's existing bcryptjs mechanism, and stores
 * ONLY the hash on a linked User account. The plaintext value is never persisted,
 * logged, or returned in any response.
 *
 * When no dateOfBirth is supplied the account step is skipped entirely, which
 * preserves the pre-Phase-9 creation workflow exactly.
 */
async function createFacultyWithCredential(facultyPayload, { facultyId }) {
  const { email, facultyName, roles } = facultyPayload;
  if (!facultyPayload.dateOfBirth || !email || !String(email).trim()) {
    return null;
  }

  const existingUser = await User.findOne({ facultyId });
  if (existingUser) {
    return null;
  }

  const credential = deriveInitialCredential(facultyPayload.dateOfBirth);
  const passwordHash = await hashCredential(credential);

  const role = Array.isArray(roles) && roles.length > 0 && ['HOD', 'ADMIN', 'TC', 'AC', 'FACULTY'].includes(roles[0])
    ? roles[0]
    : 'FACULTY';

  return User.create({
    name: facultyName,
    email: String(email).trim().toLowerCase(),
    role,
    facultyId,
    passwordHash,
    isActive: true,
  });
}

module.exports = {
  createFacultyWithCredential,
  validateDateOfBirth,
  mongoose,
};