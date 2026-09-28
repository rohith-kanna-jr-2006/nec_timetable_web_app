const mongoose = require('mongoose');

const hodFacultyAllocationSchema = new mongoose.Schema(
  {
    academicContextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicContext',
      required: [true, 'Academic context is required'],
      index: true,
    },
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    courseName: {
      type: String,
      default: '',
      trim: true,
    },
    facultyId: {
      type: String,
      required: [true, 'Faculty ID is required'],
      trim: true,
      index: true,
    },
    facultyName: {
      type: String,
      default: '',
      trim: true,
    },
    allocationType: {
      type: String,
      enum: ['THEORY', 'LAB_PRIMARY', 'LAB_ADDITIONAL', 'SAS', 'OTHERS'],
      default: 'THEORY',
    },
    assignedBy: {
      type: String,
      required: true,
      default: 'HOD',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
      default: 'DRAFT',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

hodFacultyAllocationSchema.index({ academicContextId: 1, courseCode: 1, facultyId: 1 });

module.exports = mongoose.model('HODFacultyAllocation', hodFacultyAllocationSchema);
