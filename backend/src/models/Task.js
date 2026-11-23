import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    dueDate: {
      type: Date,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
      index: true
    },
    sourceEmailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Email',
      default: null,
      index: true
    },
    sourceThreadId: {
      type: String,
      default: null,
      index: true
    },
    sourceSubject: {
      type: String,
      default: ''
    },
    sourceSender: {
      name: { type: String, default: '' },
      email: { type: String, default: '' }
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes for high-performance user queries and sorting
taskSchema.index({ user: 1, status: 1, dueDate: 1 });
taskSchema.index({ user: 1, sourceThreadId: 1 });
taskSchema.index({ user: 1, createdAt: -1 });

export const Task = mongoose.model('Task', taskSchema);
