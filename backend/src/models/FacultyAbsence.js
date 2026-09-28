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
  },
  {
    timestamps: true,
  }
);

facultyAbsenceSchema.index({ facultyId: 1, date: 1 });

module.exports = mongoose.model('FacultyAbsence', facultyAbsenceSchema);
