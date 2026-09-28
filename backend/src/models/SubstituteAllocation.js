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
  },
  {
    timestamps: true,
  }
);

substituteAllocationSchema.index({ date: 1, period: 1, substituteFacultyId: 1 });

module.exports = mongoose.model('SubstituteAllocation', substituteAllocationSchema);
