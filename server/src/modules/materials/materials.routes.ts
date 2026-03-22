import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getMaterials, addMaterial, publishMaterial, deleteMaterial } from './materials.controller';

const router = Router();
router.use(authMiddleware);

router.get('/subject/:subjectId',       getMaterials);
router.post('/',                        addMaterial);
router.patch('/:materialId/publish',    publishMaterial);
router.delete('/:materialId',           deleteMaterial);

export default router;
