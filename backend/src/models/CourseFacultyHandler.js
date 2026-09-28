const mongoose = require('mongoose');

const courseFacultyHandlerSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    candidateFacultyIds: {
      type: [String],
      default: [],
    },
    preferredFacultyId: {
      type: String,
      default: null,
      trim: true,
    },
    remarks: {
      type: String,
      default: null,
      trim: true,
    },
    submittedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CourseFacultyHandler', courseFacultyHandlerSchema);
