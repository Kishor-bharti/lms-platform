import { Request, Response } from 'express';
import { login as loginService, refreshTokens as refreshTokensService } from './auth.service';
import { LoginRequest } from './auth.types';

export async function login(req: Request, res: Response) {
  const { email, password, loginAs } = req.body as LoginRequest;

  // Basic presence check (Zod already validates shape, this is a safety net)
  if (!email || !password || !loginAs) {
    return res.status(400).json({ error: 'email, password and loginAs are required' });
  }

  try {
    const result = await loginService(email.trim(), password, loginAs);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;

    if (code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (code === 'ACCOUNT_DISABLED') {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    if (code === 'ROLE_DENIED') {
      return res.status(403).json({ error: 'Access denied for this role' });
    }

    // Genuine server error — log it but never reveal internals
    console.error('[auth] Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken: string };

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    const result = await refreshTokensService(refreshToken);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;

    if (code === 'INVALID_REFRESH_TOKEN') {
      return res.status(401).json({ error: 'Session expired, please login again' });
    }

    console.error('[auth] Refresh error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
