const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      // TC = TimeTable Coordinator (timetable-design authority)
      // AC is retained temporarily for backward-compatibility during migration.
      // Remove 'AC' from this enum only after all existing User documents
      // have been migrated to 'TC' via the migrateACtoTC migration script.
      enum: ['FACULTY', 'AC', 'TC', 'HOD', 'ADMIN'],
      default: 'FACULTY',
      required: true,
      index: true,
    },
    facultyId: {
      type: String,
      default: null,
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

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.passwordHash);
};

// Remove passwordHash from JSON transformations
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
