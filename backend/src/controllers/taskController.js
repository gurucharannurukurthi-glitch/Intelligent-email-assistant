import { extractTaskProposals } from '../services/aiService.js';
import {
  getUserTasks,
  createTask,
  updateTask,
  toggleTaskStatus,
  deleteTask
} from '../services/taskService.js';

/**
 * POST /api/tasks/detect/:threadId
 * Extracts actionable task suggestions from an email thread.
 */
export async function detectTasks(req, res, next) {
  try {
    const { threadId } = req.params;
    if (!threadId) {
      return res.status(400).json({ success: false, message: 'threadId is required' });
    }

    const taskProposals = await extractTaskProposals(req.user._id, threadId);
    return res.json({
      success: true,
      data: taskProposals
    });
  } catch (error) {
    console.error('[TaskController] Detect tasks error:', error);
    next(error);
  }
}

/**
 * GET /api/tasks
 * Retrieves the user's tasks with optional status filter.
 */
export async function getTasks(req, res, next) {
  try {
    const { status } = req.query;
    const tasks = await getUserTasks(req.user._id, { status });
    return res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('[TaskController] Get tasks error:', error);
    next(error);
  }
}

/**
 * POST /api/tasks
 * Creates a new task after user confirmation.
 */
export async function createTaskHandler(req, res, next) {
  try {
    const {
      title,
      description,
      dueDate,
      sourceEmailId,
      sourceThreadId,
      sourceSubject,
      sourceSender
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }

    const task = await createTask(req.user._id, {
      title,
      description,
      dueDate,
      sourceEmailId,
      sourceThreadId,
      sourceSubject,
      sourceSender
    });

    return res.status(task.alreadyExisted ? 200 : 201).json({
      success: true,
      task
    });
  } catch (error) {
    console.error('[TaskController] Create task error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * PATCH /api/tasks/:id
 * Updates task title, description, or due date.
 */
export async function updateTaskHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;

    const task = await updateTask(req.user._id, id, { title, description, dueDate });
    return res.json({
      success: true,
      task
    });
  } catch (error) {
    console.error('[TaskController] Update task error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * PATCH /api/tasks/:id/status
 * Toggles task between pending and completed.
 */
export async function toggleTaskStatusHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const task = await toggleTaskStatus(req.user._id, id, status);
    return res.json({
      success: true,
      task
    });
  } catch (error) {
    console.error('[TaskController] Toggle task status error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * DELETE /api/tasks/:id
 * Deletes a task.
 */
export async function deleteTaskHandler(req, res, next) {
  try {
    const { id } = req.params;
    await deleteTask(req.user._id, id);
    return res.json({
      success: true,
      message: 'Task deleted successfully.'
    });
  } catch (error) {
    console.error('[TaskController] Delete task error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}
