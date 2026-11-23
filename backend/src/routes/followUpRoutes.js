import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getFollowUps,
  evaluateFollowUpsHandler,
  generateDraftHandler,
  sendFollowUpHandler,
  dismissFollowUpHandler
} from '../controllers/followUpController.js';

const router = Router();

// Require session authentication for all follow-up operations
router.use(requireAuth);

router.get('/', getFollowUps);
router.post('/evaluate', evaluateFollowUpsHandler);
router.post('/:id/draft', generateDraftHandler);
router.post('/:id/send', sendFollowUpHandler);
router.post('/:id/dismiss', dismissFollowUpHandler);

export default router;
