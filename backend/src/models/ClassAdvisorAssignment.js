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

// Phase 8: the domain invariant is at most one ACTIVE advisor per AcademicContext.
// A partial unique index enforces it at the database level so a concurrent write
// cannot produce two active advisors, while INACTIVE history is unconstrained.
classAdvisorAssignmentSchema.index(
  { academicContextId: 1 },
  {
    unique: true,
    name: 'active_advisor_per_context_idx',
    partialFilterExpression: { status: 'ACTIVE' },
  }
);

module.exports = mongoose.model('ClassAdvisorAssignment', classAdvisorAssignmentSchema);
