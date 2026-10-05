const mongoose = require('mongoose');

const sessionFacultyAssignmentSchema = new mongoose.Schema(
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
      default: 'PRIMARY',
      trim: true,
    },
  },
  { _id: false }
);

const timetableSessionSchema = new mongoose.Schema(
  {
    timetableVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimetableVersion',
      required: [true, 'Timetable version ID is required'],
      index: true,
    },
    academicContextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicContext',
      default: null,
      index: true,
    },
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      trim: true,
      uppercase: true,
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
    facultyAssignments: {
      type: [sessionFacultyAssignmentSchema],
      default: [],
    },
    day: {
      type: String,
      enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      required: [true, 'Day is required'],
    },
    period: {
      type: String,
      required: [true, 'Period is required'],
      trim: true,
    },
    room: {
      type: String,
      default: null,
      trim: true,
    },
    sessionType: {
      type: String,
      enum: ['THEORY', 'LAB', 'SAS', 'PBL', 'TUTORIAL', 'MC', 'OTHER'],
      default: 'THEORY',
    },
    duration: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Conflict detection unique slot indexes
timetableSessionSchema.index(
  { timetableVersionId: 1, facultyId: 1, day: 1, period: 1 },
  { name: 'session_faculty_slot_idx', unique: true }
);
timetableSessionSchema.index(
  { timetableVersionId: 1, academicContextId: 1, day: 1, period: 1 },
  { name: 'session_class_slot_idx', unique: true, partialFilterExpression: { academicContextId: { $exists: true, $ne: null } } }
);
timetableSessionSchema.index({ academicContextId: 1, timetableVersionId: 1 });
timetableSessionSchema.index({ 'facultyAssignments.facultyId': 1 });

module.exports = mongoose.model('TimetableSession', timetableSessionSchema);

