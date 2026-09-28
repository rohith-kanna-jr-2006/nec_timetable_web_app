const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: {
      type: String,
      required: [true, 'Recipient user ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: [
        'ALLOCATION',
        'TIMETABLE_SUBMITTED',
        'TIMETABLE_APPROVED',
        'TIMETABLE_REJECTED',
        'ABSENCE',
        'SUBSTITUTE',
        'SYSTEM',
      ],
      default: 'SYSTEM',
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    relatedEntity: {
      type: String,
      default: null,
    },
    relatedEntityId: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipientUserId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
