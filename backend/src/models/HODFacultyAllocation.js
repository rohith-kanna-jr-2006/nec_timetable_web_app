const mongoose = require('mongoose');

const facultyAssignmentSchema = new mongoose.Schema(
  {
    facultyId: {
      type: String,
      required: true,
      trim: true,
    },
    facultyName: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      enum: ['PRIMARY', 'ADDITIONAL', 'OPTIONAL', 'MATHS_BME', 'ENGLISH', 'THEORY', 'OTHER'],
      default: 'PRIMARY',
    },
    required: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      enum: ['THEORY_LINKED', 'MANUAL'],
      default: 'MANUAL',
    },
  },
  { _id: false }
);

const timetableMappingSchema = new mongoose.Schema(
  {
    allowed: {
      type: Boolean,
      default: true,
    },
    required: {
      type: Boolean,
      default: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

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
    allocationRule: {
      type: String,
      enum: ['THEORY_SINGLE', 'LAB_2_TO_3', 'MC_SAS', 'MC_DEPARTMENT', 'MC_OPTIONAL_MAPPING', 'OTHER'],
      default: 'THEORY_SINGLE',
      index: true,
    },
    facultyId: {
      type: String,
      default: null,
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
    facultyAssignments: {
      type: [facultyAssignmentSchema],
      default: [],
    },
    timetableMapping: {
      type: timetableMappingSchema,
      default: () => ({ allowed: true, required: true, enabled: true }),
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
hodFacultyAllocationSchema.index({ academicContextId: 1, courseCode: 1 });
hodFacultyAllocationSchema.index({ 'facultyAssignments.facultyId': 1 });

module.exports = mongoose.model('HODFacultyAllocation', hodFacultyAllocationSchema);

