const bcrypt = require('bcryptjs');

/**
 * Phase 9 — DOB-derived initial credential helpers.
 *
 * The initial credential is derived as DDMMYYYY from the faculty date of birth.
 * SECURITY CONTRACT:
 * - The derived value exists only transiently, in memory, inside the account
 *   creation call. It is never persisted, never logged and never returned.
 * - Only the bcrypt hash is stored, on User.passwordHash.
 * - bcryptjs is the project's existing hashing mechanism (User.comparePassword);
 *   this module introduces no second mechanism.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a date-of-birth value into its calendar parts.
 *
 * Accepts an ISO 'YYYY-MM-DD' string or a Date. A Date is read through its UTC
 * getters, because the value is stored at UTC midnight; using local getters would
 * shift the calendar day for anyone east of UTC and produce a wrong credential.
 *
 * Returns null when the value is absent, malformed or not a real calendar date.
 */
function parseDateOfBirth(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  if (typeof value !== 'string') return null;
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Reject impossible calendar dates that Date would silently roll over
  // (e.g. 2003-02-31 becoming 2003-03-03).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/**
 * Renders date-of-birth parts as the DDMMYYYY initial credential.
 * Returns null when the value cannot be parsed deterministically.
 */
function deriveInitialCredential(value) {
  const parts = parseDateOfBirth(value);
  if (!parts) return null;
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  return `${dd}${mm}${parts.year}`;
}

/**
 * Hashes a credential with the project's existing bcryptjs mechanism.
 * Returns null for an unusable input so no hash is ever produced from junk.
 */
async function hashCredential(credential) {
  if (typeof credential !== 'string' || !credential.trim()) return null;
  return bcrypt.hash(credential, 10);
}

/** Normalises an accepted DOB input into a UTC-midnight Date, or null. */
function toDateOfBirth(value) {
  const parts = parseDateOfBirth(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

module.exports = {
  parseDateOfBirth,
  deriveInitialCredential,
  hashCredential,
  toDateOfBirth,
  ISO_DATE_PATTERN,
};