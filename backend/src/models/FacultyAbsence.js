const mongoose = require('mongoose');

const facultyAbsenceSchema = new mongoose.Schema(
  {
    facultyId: {
      type: String,
      required: [true, 'Faculty ID is required'],
      trim: true,
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Absence date is required (YYYY-MM-DD)'],
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reportedBy: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: String,
      default: null,
    },
    // Phase 7: an absence is raised against a specific AcademicContext so the
    // affected TimetableSession can be resolved deterministically inside that
    // context instead of globally. Optional so pre-Phase-7 records (which carry
    // no context) remain valid and need no backfill; when null the substitute
    // mapping flow requires the caller to supply the context explicitly.
    academicContextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicContext',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

facultyAbsenceSchema.index({ facultyId: 1, date: 1 });
facultyAbsenceSchema.index({ academicContextId: 1, date: 1, status: 1 });

module.exports = mongoose.model('FacultyAbsence', facultyAbsenceSchema);
