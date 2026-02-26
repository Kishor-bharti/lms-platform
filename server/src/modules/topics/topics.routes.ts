import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as ctrl from './topics.controller';

const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.get('/',            ctrl.getTopics);
router.post('/',           ctrl.createTopic);
router.patch('/:topicId',  ctrl.updateTopic);
router.delete('/:topicId', ctrl.deleteTopic);
export default router;
