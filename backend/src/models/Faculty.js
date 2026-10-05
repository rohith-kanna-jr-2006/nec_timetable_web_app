const mongoose = require('mongoose');
const { parseDateOfBirth } = require('../utils/facultyCredentials');

const facultySchema = new mongoose.Schema(
  {
    facultyId: {
      type: String,
      required: [true, 'Faculty ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    facultyName: {
      type: String,
      required: [true, 'Faculty name is required'],
      trim: true,
      index: true,
    },
    // Phase 9: date of birth is date-only domain data. It is stored at UTC
    // midnight and always read back through UTC getters so the calendar day is
    // preserved instead of drifting across timezones.
    dateOfBirth: {
      type: Date,
      default: null,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    department: {
      type: String,
      default: 'Computer Science and Engineering',
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    roles: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Rejects a date of birth that is not a real calendar date or lies in the
 * future. Stored values always come from an already-parsed Date, so this guards
 * the write path rather than re-parsing text.
 */
facultySchema.path('dateOfBirth').validate(function validateDob(value) {
  if (value === null || value === undefined) return true;
  if (Number.isNaN(new Date(value).getTime())) return false;
  // Compare on the calendar day, ignoring time of day.
  const today = new Date();
  const todayUtcMidnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return new Date(value).getTime() <= todayUtcMidnight;
}, 'dateOfBirth must be a valid, real calendar date and cannot be in the future');

// Sanity helper reused by the validators.
facultySchema.statics.isValidDateOfBirth = function isValidDateOfBirth(value) {
  return parseDateOfBirth(value) !== null;
};

module.exports = mongoose.model('Faculty', facultySchema);
