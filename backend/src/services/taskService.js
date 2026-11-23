import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { Email } from '../models/Email.js';

/**
 * Retrieves tasks belonging to the authenticated user with optional status filter.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {Object} [options] - Filter and pagination options
 * @param {string} [options.status] - 'pending' | 'completed' | 'all'
 * @returns {Promise<Array<Object>>} List of tasks
 */
export async function getUserTasks(userId, options = {}) {
  const query = { user: userId };

  if (options.status && ['pending', 'completed'].includes(options.status)) {
    query.status = options.status;
  }

  // Sort: Pending first, then by dueDate ascending (urgent first, null last), then createdAt descending
  return Task.find(query)
    .sort({ status: -1, dueDate: 1, createdAt: -1 })
    .lean();
}

/**
 * Creates a new task after user confirmation with duplicate prevention.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {Object} taskData - Task payload
 * @returns {Promise<Object>} Created task object
 */
export async function createTask(userId, taskData) {
  if (!taskData || !taskData.title || !taskData.title.trim()) {
    const error = new Error('Task title is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanTitle = taskData.title.trim();

  // 1. Duplicate Prevention: Check if task with identical title already exists for this thread
  if (taskData.sourceThreadId) {
    const existing = await Task.findOne({
      user: userId,
      sourceThreadId: taskData.sourceThreadId,
      title: cleanTitle
    });

    if (existing) {
      return {
        ...existing.toObject(),
        alreadyExisted: true
      };
    }
  }

  // 2. Parse due date safely if provided
  let parsedDueDate = null;
  if (taskData.dueDate) {
    const d = new Date(taskData.dueDate);
    if (!isNaN(d.getTime())) {
      parsedDueDate = d;
    }
  }

  // 3. Populate email context metadata if sourceEmailId is provided
  let sourceSubject = taskData.sourceSubject || '';
  let sourceSender = taskData.sourceSender || { name: '', email: '' };

  if (taskData.sourceEmailId && (!sourceSubject || !sourceSender.email)) {
    try {
      const email = await Email.findOne({ _id: taskData.sourceEmailId, user: userId }).lean();
      if (email) {
        sourceSubject = sourceSubject || email.subject || '';
        sourceSender = sourceSender.email ? sourceSender : email.sender || { name: '', email: '' };
      }
    } catch (dbErr) {
      // Non-critical, continue
    }
  }

  const newTask = await Task.create({
    user: userId,
    title: cleanTitle,
    description: (taskData.description || '').trim(),
    dueDate: parsedDueDate,
    status: 'pending',
    sourceEmailId: taskData.sourceEmailId || null,
    sourceThreadId: taskData.sourceThreadId || null,
    sourceSubject,
    sourceSender
  });

  return {
    ...newTask.toObject(),
    alreadyExisted: false
  };
}

/**
 * Updates task details (title, description, dueDate).
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated task
 */
export async function updateTask(userId, taskId, updates) {
  const task = await Task.findOne({ _id: taskId, user: userId });
  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  if (updates.title !== undefined) {
    if (!updates.title.trim()) {
      const error = new Error('Task title cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    task.title = updates.title.trim();
  }

  if (updates.description !== undefined) {
    task.description = updates.description.trim();
  }

  if (updates.dueDate !== undefined) {
    if (updates.dueDate === null || updates.dueDate === '') {
      task.dueDate = null;
    } else {
      const d = new Date(updates.dueDate);
      task.dueDate = isNaN(d.getTime()) ? null : d;
    }
  }

  await task.save();
  return task.toObject();
}

/**
 * Toggles a task's status between 'pending' and 'completed'.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} taskId - Task ID
 * @param {string} [newStatus] - Optional target status ('pending' | 'completed')
 * @returns {Promise<Object>} Updated task
 */
export async function toggleTaskStatus(userId, taskId, newStatus) {
  const task = await Task.findOne({ _id: taskId, user: userId });
  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  const targetStatus = newStatus || (task.status === 'completed' ? 'pending' : 'completed');
  task.status = targetStatus;
  task.completedAt = targetStatus === 'completed' ? new Date() : null;

  await task.save();
  return task.toObject();
}

/**
 * Deletes a task owned by the authenticated user.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} taskId - Task ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteTask(userId, taskId) {
  const result = await Task.deleteOne({ _id: taskId, user: userId });
  if (result.deletedCount === 0) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }
  return true;
}

/**
 * Retrieves any already created tasks for a specific email thread.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} threadId - Thread ID
 * @returns {Promise<Array<Object>>} List of existing tasks for thread
 */
export async function getTasksForThread(userId, threadId) {
  return Task.find({ user: userId, sourceThreadId: threadId }).lean();
}
