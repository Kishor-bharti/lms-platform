import { Request, Response } from 'express';
import logger from '../../config/logger';
import * as materialsService from './materials.service';
import { hasContentWritePermission } from '../../utils/permissions';

export async function getMaterials(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
    const role   = req.user?.role ?? 'student';
    const userId = req.user?.id;
    const materials = await materialsService.getMaterials(subjectId, role, userId);
    return res.json(materials);
  } catch (err) {
    logger.error('[materials] get:', err);
    return res.status(500).json({ error: 'Failed to fetch materials' });
  }
}

export async function addMaterial(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;
    const { subjectId, title, description, material_type, file_url, file_size_kb, topicId } = req.body;
    if (!subjectId || !title || !material_type || !file_url) {
      return res.status(400).json({ error: 'subjectId, title, material_type, file_url are required' });
    }
    const canCreate = await hasContentWritePermission(userId, role, subjectId);
    if (!canCreate) {
      return res.status(403).json({ error: 'Insufficient permissions to add materials in this subject' });
    }
    const valid = ['pdf', 'video', 'doc', 'image', 'pptx', 'zip'];
    if (!valid.includes(material_type)) {
      return res.status(400).json({ error: `material_type must be one of: ${valid.join(', ')}` });
    }
    const material = await materialsService.addMaterial({
      subjectId, uploadedBy: userId, title, description, material_type, file_url, file_size_kb, topicId,
    });
    return res.status(201).json(material);
  } catch (err) {
    logger.error('[materials] add:', err);
    return res.status(500).json({ error: 'Failed to add material' });
  }
}

export async function updateMaterial(req: Request, res: Response) {
  try {
    const { materialId } = req.params;
    if (!materialId) return res.status(400).json({ error: 'materialId is required' });
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can edit materials' });
    }
    const { title, description, material_type, file_url, topicId } = req.body;
    const updated = await materialsService.updateMaterial(materialId, { title, description, material_type, file_url, topicId });
    return res.json(updated);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Material not found' });
    logger.error('[materials] update:', err);
    return res.status(500).json({ error: 'Failed to update material' });
  }
}

export async function publishMaterial(req: Request, res: Response) {
  try {
    const { materialId } = req.params;
    if (!materialId) return res.status(400).json({ error: 'materialId is required' });
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can publish materials' });
    }
    const { is_published } = req.body;
    await materialsService.publishMaterial(materialId, Boolean(is_published));
    return res.json({ success: true });
  } catch (err) {
    logger.error('[materials] publish:', err);
    return res.status(500).json({ error: 'Failed to update material' });
  }
}

export async function deleteMaterial(req: Request, res: Response) {
  try {
    const { materialId } = req.params;
    if (!materialId) return res.status(400).json({ error: 'materialId is required' });
    if (req.user!.role !== 'admin' && req.user!.role !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const userId = req.user!.id;
    await materialsService.deleteMaterial(materialId, userId);
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'Cannot remove a published material. Unpublish it first or contact admin.' });
    logger.error('[materials] delete:', err);
    return res.status(500).json({ error: 'Failed to delete material' });
  }
}
