import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    messageId: {
      type: String,
      required: true,
      index: true
    },
    threadId: {
      type: String,
      required: true,
      index: true
    },
    sender: {
      name: { type: String, default: '' },
      email: { type: String, default: '' }
    },
    recipients: [
      {
        name: { type: String, default: '' },
        email: { type: String, default: '' }
      }
    ],
    subject: {
      type: String,
      default: '(No Subject)'
    },
    bodyText: {
      type: String,
      default: ''
    },
    bodyHtml: {
      type: String,
      default: ''
    },
    snippet: {
      type: String,
      default: ''
    },
    labels: [
      {
        type: String
      }
    ],
    isRead: {
      type: Boolean,
      default: false
    },
    isStarred: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    aiSummary: {
      type: String,
      default: null
    },
    // Reserved for V2 Semantic Search (excluded from default queries)
    embedding: {
      type: [Number],
      select: false,
      default: undefined
    },
    // V3.1 Email -> Google Calendar event creation tracking & duplicate protection
    calendarEvent: {
      eventId: { type: String, default: null },
      htmlLink: { type: String, default: null },
      summary: { type: String, default: null },
      startDateTime: { type: Date, default: null },
      endDateTime: { type: Date, default: null },
      createdAt: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);

// Compound index to guarantee uniqueness per user and messageId
emailSchema.index({ user: 1, messageId: 1 }, { unique: true });
emailSchema.index({ user: 1, threadId: 1 });
emailSchema.index({ user: 1, receivedAt: -1 });
emailSchema.index({ user: 1, isArchived: 1, receivedAt: -1 });

export const Email = mongoose.model('Email', emailSchema);
