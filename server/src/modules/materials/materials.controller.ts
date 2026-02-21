import { Request, Response } from 'express';
import * as materialsService from './materials.service';

export async function getMaterials(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const materials = await materialsService.getMaterials(subjectId);
    return res.json(materials);
  } catch (err) {
    console.error('[materials] get:', err);
    return res.status(500).json({ error: 'Failed to fetch materials' });
  }
}

export async function addMaterial(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can add materials' });
    }
    const { subjectId, title, description, material_type, file_url, file_size_kb } = req.body;
    if (!subjectId || !title || !material_type || !file_url) {
      return res.status(400).json({ error: 'subjectId, title, material_type, file_url are required' });
    }
    const valid = ['pdf', 'video', 'link', 'doc', 'image'];
    if (!valid.includes(material_type)) {
      return res.status(400).json({ error: `material_type must be one of: ${valid.join(', ')}` });
    }
    const material = await materialsService.addMaterial({
      subjectId, uploadedBy: userId, title, description, material_type, file_url, file_size_kb,
    });
    return res.status(201).json(material);
  } catch (err) {
    console.error('[materials] add:', err);
    return res.status(500).json({ error: 'Failed to add material' });
  }
}

export async function deleteMaterial(req: Request, res: Response) {
  try {
    const { materialId } = req.params;
    const userId = req.user!.id;
    await materialsService.deleteMaterial(materialId, userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[materials] delete:', err);
    return res.status(500).json({ error: 'Failed to delete material' });
  }
}
