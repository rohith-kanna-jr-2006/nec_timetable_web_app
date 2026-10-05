const mongoose = require('mongoose');
const {
  parseAcademicYear,
  formatAcademicYear,
  isValidRange,
  resolveAcademicYearRange,
} = require('../utils/academicYearRange');

const academicContextSchema = new mongoose.Schema(
  {
    // Phase 8: the canonical academic year is an explicit range. These two
    // fields are the single authoritative representation. The academicYear
    // string below is only a derived compatibility mirror so that existing
    // consumers keep working unchanged.
    academicYearFrom: {
      type: Number,
      required: [true, 'Academic year start is required'],
    },
    academicYearTo: {
      type: Number,
      required: [true, 'Academic year end is required'],
    },
    academicYear: {
      // Legacy compatibility mirror, e.g. '2026-27'. Never the source of truth.
      type: String,
      trim: true,
    },
    semester: {
      type: String,
      required: [true, 'Semester is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      uppercase: true,
    },
    fromYear: {
      type: String,
      required: [true, 'From Year is required'],
      trim: true,
    },
    toYear: {
      type: String,
      required: [true, 'To Year is required'],
      trim: true,
    },
    regulation: {
      type: String,
      required: [true, 'Regulation is required'],
      trim: true,
    },
    year: {
      type: String,
      required: [true, 'Year is required'],
      trim: true,
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
      uppercase: true,
    },
    program: {
      type: String,
      enum: ['UG', 'PG'],
      default: 'UG',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Phase 8: one authoritative academic-year representation.
 *
 * The canonical range is academicYearFrom/academicYearTo. When a caller only
 * supplies the legacy academicYear string it is parsed into the range; whenever a
 * range is present the compatibility mirror is regenerated from it. This keeps
 * older writers working while making from/to the only source of truth.
 */
academicContextSchema.pre('validate', function normaliseAcademicYear(next) {
  try {
    const hasFrom = this.academicYearFrom !== undefined && this.academicYearFrom !== null && this.academicYearFrom !== '';
    const hasTo = this.academicYearTo !== undefined && this.academicYearTo !== null && this.academicYearTo !== '';

    if (!hasFrom && !hasTo) {
      // Legacy-only writer: derive the canonical range from the string.
      const parsed = parseAcademicYear(this.academicYear);
      if (!parsed) {
        this.invalidate('academicYear', 'Academic year must be a canonical YYYY-YY range such as 2026-27');
        return next();
      }
      this.academicYearFrom = parsed.academicYearFrom;
      this.academicYearTo = parsed.academicYearTo;
    } else if (hasFrom && !hasTo) {
      this.invalidate('academicYearTo', 'Academic year end is required when academicYearFrom is supplied');
      return next();
    } else if (!hasFrom && hasTo) {
      this.invalidate('academicYearFrom', 'Academic year start is required when academicYearTo is supplied');
      return next();
    } else {
      this.academicYearFrom = Number(this.academicYearFrom);
      this.academicYearTo = Number(this.academicYearTo);
    }

    if (!isValidRange(this.academicYearFrom, this.academicYearTo)) {
      this.invalidate('academicYearTo', 'Academic year must be a valid range with academicYearFrom < academicYearTo');
      return next();
    }

    // Keep the legacy mirror consistent with the canonical range.
    this.academicYear = formatAcademicYear(this.academicYearFrom, this.academicYearTo);
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Resolves any accepted input shape into the canonical from/to pair.
 */
academicContextSchema.statics.resolveRange = function resolveRange(input) {
  return resolveAcademicYearRange(input);
};

/**
 * Display label for the context, e.g. '2026-27 III Year A'.
 */
academicContextSchema.methods.displayLabel = function displayLabel() {
  const year = formatAcademicYear(this.academicYearFrom, this.academicYearTo) || this.academicYear || '';
  return [year, this.year, this.section].filter(Boolean).join(' ');
};

// Compound unique index (legacy mirror, retained so pre-Phase-8 callers keep
// their uniqueness guarantee).
academicContextSchema.index(
  { academicYear: 1, semester: 1, department: 1, year: 1, section: 1 },
  { unique: true }
);

// Phase 8 identity: the canonical academic-year range participates in the
// AcademicContext identity so 2026-27/III-A and 2027-28/III-A are distinct.
academicContextSchema.index(
  { academicYearFrom: 1, academicYearTo: 1, semester: 1, department: 1, year: 1, section: 1 },
  { unique: true, name: 'academic_year_range_identity_idx' }
);

// Supports range queries over the academic year.
academicContextSchema.index({ academicYearFrom: 1, academicYearTo: 1, department: 1, semester: 1 });

module.exports = mongoose.model('AcademicContext', academicContextSchema);
