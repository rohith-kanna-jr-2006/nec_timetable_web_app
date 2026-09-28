const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    courseName: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
    },
    courseType: {
      type: String,
      enum: ['THEORY', 'LAB', 'SAS', 'OTHERS', 'PROJECT', 'EEC', 'MC'],
      default: 'THEORY',
    },
    category: {
      type: String,
      default: 'Professional Core',
      trim: true,
    },
    credits: {
      type: Number,
      default: 3,
      min: 0,
    },
    regulation: {
      type: String,
      default: 'R22',
      trim: true,
      index: true,
    },
    programme: {
      type: String,
      default: 'B.E. Computer Science and Engineering',
      trim: true,
    },
    academicYear: {
      type: String,
      default: '2024-25 onwards',
      trim: true,
    },
    curriculumYear: {
      type: String,
      default: '2024-25 onwards',
      trim: true,
    },
    semester: {
      type: String,
      required: [true, 'Semester is required'],
      default: 'Odd Semester',
      trim: true,
      index: true,
    },
    department: {
      type: String,
      default: 'CSE',
      trim: true,
    },
    prerequisite: {
      type: String,
      default: '-',
      trim: true,
    },
    contactPeriod: {
      type: String,
      default: '-',
      trim: true,
    },
    contactHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    L: {
      type: Number,
      default: 0,
      min: 0,
    },
    T: {
      type: Number,
      default: 0,
      min: 0,
    },
    P: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPeriod: {
      type: Number,
      default: 0,
      min: 0,
    },
    electiveSlot: {
      type: String,
      default: null,
      trim: true,
    },
    electiveType: {
      type: String,
      default: null,
      trim: true,
    },
    vertical: {
      type: String,
      default: null,
      trim: true,
    },
    isLab: {
      type: Boolean,
      default: false,
    },
    isR22UG: {
      type: Boolean,
      default: false,
      index: true,
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

courseSchema.index({ courseCode: 1, department: 1, regulation: 1 });
courseSchema.index({ regulation: 1, semester: 1 });
courseSchema.index({ isR22UG: 1, vertical: 1 });

module.exports = mongoose.model('Course', courseSchema);
