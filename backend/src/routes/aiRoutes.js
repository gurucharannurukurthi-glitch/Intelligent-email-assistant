import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.post('/summarize/:emailId', aiController.summarizeEmail);
router.post('/draft-reply/:emailId', aiController.draftReply);

export default router;
