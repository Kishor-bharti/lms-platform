import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getMaterials, addMaterial, updateMaterial, publishMaterial, deleteMaterial, getMaterialUrl } from './materials.controller';

const router = Router();
router.use(authMiddleware);

router.get('/subject/:subjectId',       getMaterials);
router.get('/:materialId/url',          getMaterialUrl);
router.post('/',                        addMaterial);
router.put('/:materialId',             updateMaterial);
router.patch('/:materialId/publish',    publishMaterial);
router.delete('/:materialId',           deleteMaterial);

export default router;
