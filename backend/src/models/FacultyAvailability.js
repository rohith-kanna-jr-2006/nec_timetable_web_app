const mongoose = require('mongoose');

const facultyAvailabilitySchema = new mongoose.Schema(
  {
    facultyId: {
      type: String,
      required: [true, 'Faculty ID is required'],
      trim: true,
      index: true,
    },
    academicContextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicContext',
      default: null,
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
    status: {
      type: String,
      enum: ['AVAILABLE', 'UNAVAILABLE', 'PREFERRED_OFF'],
      default: 'UNAVAILABLE',
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

facultyAvailabilitySchema.index({ facultyId: 1, day: 1, period: 1 });

module.exports = mongoose.model('FacultyAvailability', facultyAvailabilitySchema);
