import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  detectTasks,
  getTasks,
  createTaskHandler,
  updateTaskHandler,
  toggleTaskStatusHandler,
  deleteTaskHandler
} from '../controllers/taskController.js';

const router = Router();

// Require session authentication for all task operations
router.use(requireAuth);

router.post('/detect/:threadId', detectTasks);
router.get('/', getTasks);
router.post('/', createTaskHandler);
router.patch('/:id', updateTaskHandler);
router.patch('/:id/status', toggleTaskStatusHandler);
router.delete('/:id', deleteTaskHandler);

export default router;
