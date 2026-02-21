import { Request, Response } from 'express';
import * as profileService from './profile.service';

export async function getProfile(req: Request, res: Response) {
  try {
    const profile = await profileService.getProfile(req.user!.id);
    return res.json(profile);
  } catch (err: any) {
    if (err.message === 'User not found') return res.status(404).json({ error: 'Not found' });
    console.error('[profile] get:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const { first_name, last_name, phone } = req.body;
    const profile = await profileService.updateProfile(req.user!.id, { first_name, last_name, phone });
    return res.json(profile);
  } catch (err) {
    console.error('[profile] update:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password required' });
    }
    await profileService.changePassword(req.user!.id, { current_password, new_password });
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'WRONG_PASSWORD') return res.status(401).json({ error: 'Current password is incorrect' });
    if (err.message === 'TOO_SHORT')      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    console.error('[profile] password:', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
}
