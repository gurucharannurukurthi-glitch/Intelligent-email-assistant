import { Router } from 'express';
import * as emailController from '../controllers/emailController.js';
import * as searchController from '../controllers/searchController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.get('/', emailController.listEmails);
router.get('/contacts', emailController.getContacts);
router.post('/sync', emailController.syncInbox);

// V2 Semantic Search and Embedding Management Routes
router.get('/search/semantic', searchController.semanticSearch);
router.get('/embeddings/status', searchController.getEmbeddingStatus);
router.post('/embeddings/backfill', searchController.backfillEmbeddings);

router.get('/:threadId', emailController.getThread);
router.patch('/:id', emailController.updateEmail);
router.delete('/thread/:threadId', emailController.deleteThread);
router.delete('/:id', emailController.deleteEmail);
router.post('/send', emailController.sendEmail);


export default router;
