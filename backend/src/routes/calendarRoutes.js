import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { detectMeeting, createEvent } from '../controllers/calendarController.js';

const router = Router();

// Require authentication for all calendar operations
router.use(requireAuth);

router.post('/detect/:threadId', detectMeeting);
router.post('/events', createEvent);

export default router;
