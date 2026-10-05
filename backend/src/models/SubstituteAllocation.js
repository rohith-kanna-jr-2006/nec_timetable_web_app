const mongoose = require('mongoose');

const substituteAllocationSchema = new mongoose.Schema(
  {
    absenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyAbsence',
      required: [true, 'Absence ID is required'],
      index: true,
    },
    originalFacultyId: {
      type: String,
      required: [true, 'Original faculty ID is required'],
      trim: true,
      index: true,
    },
    substituteFacultyId: {
      type: String,
      required: [true, 'Substitute faculty ID is required'],
      trim: true,
      index: true,
    },
    timetableSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimetableSession',
      required: [true, 'Timetable session ID is required'],
    },
    date: {
      type: String,
      required: [true, 'Date is required (YYYY-MM-DD)'],
      trim: true,
    },
    period: {
      type: String,
      required: [true, 'Period is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    assignedBy: {
      type: String,
      default: 'HOD',
    },
    // Phase 7 context/version anchoring. Both are optional so the two existing
    // records created before Phase 7 stay valid without a migration; every new
    // mapping written by substituteMappingService persists them, which is what
    // makes cross-context and cross-version mapping detectable.
    academicContextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicContext',
      default: null,
      index: true,
    },
    timetableVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimetableVersion',
      default: null,
      index: true,
    },
    // Phase 7: the timetable weekday the mapping covers, copied from the resolved
    // TimetableSession so a mapping can be validated against a calendar date
    // without re-deriving it from an ambiguous client claim.
    day: {
      type: String,
      enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

substituteAllocationSchema.index({ date: 1, period: 1, substituteFacultyId: 1 });
// Phase 7: one substitute cannot cover two different sessions at the same slot,
// and one session cannot be covered twice by the same substitute.
substituteAllocationSchema.index(
  { timetableSessionId: 1, substituteFacultyId: 1, date: 1, period: 1 },
  { name: 'substitute_slot_unique_idx', unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'ACCEPTED'] } } }
);
substituteAllocationSchema.index({ substituteFacultyId: 1, date: 1, period: 1, status: 1 });

module.exports = mongoose.model('SubstituteAllocation', substituteAllocationSchema);
