const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema(
  {
    facultyId: {
      type: String,
      required: [true, 'Faculty ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    facultyName: {
      type: String,
      required: [true, 'Faculty name is required'],
      trim: true,
      index: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    department: {
      type: String,
      default: 'Computer Science and Engineering',
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    roles: {
      type: [String],
      default: [],
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

module.exports = mongoose.model('Faculty', facultySchema);
