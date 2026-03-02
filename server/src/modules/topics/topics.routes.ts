import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';
import * as ctrl from './topics.controller';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// All authenticated users can view topics
router.get('/', ctrl.getTopics);

// Only admin can create, update, delete topics
router.post('/', rbacMiddleware(['admin']), ctrl.createTopic);
router.patch('/:topicId', rbacMiddleware(['admin']), ctrl.updateTopic);
router.delete('/:topicId', rbacMiddleware(['admin']), ctrl.deleteTopic);

export default router;
