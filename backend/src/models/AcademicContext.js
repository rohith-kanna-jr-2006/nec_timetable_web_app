const mongoose = require('mongoose');

const academicContextSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: [true, 'Academic Year is required'],
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

// Compound unique index
academicContextSchema.index(
  { academicYear: 1, semester: 1, department: 1, year: 1, section: 1 },
  { unique: true }
);

module.exports = mongoose.model('AcademicContext', academicContextSchema);
