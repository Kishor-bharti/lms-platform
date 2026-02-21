import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getMaterials, addMaterial, deleteMaterial } from './materials.controller';

const router = Router();
router.use(authMiddleware);

router.get('/subject/:subjectId',   getMaterials);
router.post('/',                    addMaterial);
router.delete('/:materialId',       deleteMaterial);

export default router;
