const mongoose = require('mongoose');

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
      enum: ['THEORY', 'LAB', 'SAS', 'PBL', 'TUTORIAL', 'OTHER'],
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

// Conflict detection indexes
timetableSessionSchema.index(
  { timetableVersionId: 1, facultyId: 1, day: 1, period: 1 },
  { name: 'session_faculty_slot_idx' }
);
timetableSessionSchema.index(
  { timetableVersionId: 1, academicContextId: 1, day: 1, period: 1 },
  { name: 'session_class_slot_idx' }
);

module.exports = mongoose.model('TimetableSession', timetableSessionSchema);
