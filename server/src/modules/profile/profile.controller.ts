import { Request, Response } from 'express';
import logger from '../../config/logger';
import * as profileService from './profile.service';
import { query } from '../../config/db';

export async function getProfile(req: Request, res: Response) {
  try {
    const profile = await profileService.getProfile(req.user!.id);
    return res.json(profile);
  } catch (err: any) {
    if (err.message === 'User not found') return res.status(404).json({ error: 'Not found' });
    logger.error('[profile] get:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const { first_name, last_name, phone } = req.body;
    const profile = await profileService.updateProfile(req.user!.id, { first_name, last_name, phone });
    return res.json(profile);
  } catch (err) {
    logger.error('[profile] update:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    // Only super admin can change their own password via profile
    const rows = await query<any>(`SELECT is_super_admin FROM users WHERE id = $1`, [req.user!.id]);
    if (!rows[0]?.is_super_admin) {
      return res.status(403).json({ error: 'Only the super admin can change passwords. Contact your administrator.' });
    }

    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password required' });
    }
    await profileService.changePassword(req.user!.id, { current_password, new_password });
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'WRONG_PASSWORD') return res.status(401).json({ error: 'Current password is incorrect' });
    if (err.message === 'TOO_SHORT')      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    logger.error('[profile] password:', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
}
