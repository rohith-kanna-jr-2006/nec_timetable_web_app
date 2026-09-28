const mongoose = require('mongoose');

const classAdvisorAssignmentSchema = new mongoose.Schema(
  {
    academicContextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicContext',
      required: [true, 'Academic context is required'],
      index: true,
    },
    facultyId: {
      type: String,
      required: [true, 'Faculty ID is required'],
      trim: true,
      index: true,
    },
    assignedBy: {
      type: String,
      required: true,
      default: 'HOD',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

classAdvisorAssignmentSchema.index({ academicContextId: 1, status: 1 });

module.exports = mongoose.model('ClassAdvisorAssignment', classAdvisorAssignmentSchema);
