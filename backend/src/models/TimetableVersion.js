const mongoose = require('mongoose');

const timetableVersionSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    year: {
      type: String,
      default: null,
      trim: true,
    },
    section: {
      type: String,
      default: null,
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    versionLabel: {
      type: String,
      default: 'v1.0',
    },
    status: {
      type: String,
      enum: [
        'NO_TIMETABLE',
        'DRAFT',
        'GENERATED',
        'PENDING_HOD_APPROVAL',
        'REJECTED',
        'APPROVED',
        'PUBLISHED',
      ],
      default: 'NO_TIMETABLE',
      index: true,
    },
    generatedBy: {
      type: String,
      default: null,
    },
    submittedBy: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    hardConflicts: {
      type: Number,
      default: 0,
    },
    totalScheduledPeriods: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

timetableVersionSchema.index({ academicYear: 1, semester: 1, department: 1, status: 1 });

module.exports = mongoose.model('TimetableVersion', timetableVersionSchema);
