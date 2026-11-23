import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    threadId: {
      type: String,
      required: true,
      index: true
    },
    sourceEmailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Email',
      required: true,
      index: true
    },
    recipient: {
      name: { type: String, default: '' },
      email: { type: String, required: true }
    },
    subject: {
      type: String,
      default: '(No Subject)'
    },
    reason: {
      type: String,
      default: ''
    },
    sentAt: {
      type: Date,
      required: true,
      index: true
    },
    waitingDays: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['suggested', 'dismissed', 'sent'],
      default: 'suggested',
      index: true
    },
    dismissedAt: {
      type: Date,
      default: null
    },
    followUpSentAt: {
      type: Date,
      default: null
    },
    draftText: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Indexes for user-scoped active follow-up queries and duplicate protection
followUpSchema.index({ user: 1, threadId: 1, sourceEmailId: 1 });
followUpSchema.index({ user: 1, status: 1, sentAt: -1 });

export const FollowUp = mongoose.model('FollowUp', followUpSchema);
