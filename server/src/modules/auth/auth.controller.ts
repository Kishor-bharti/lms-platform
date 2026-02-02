import { Request, Response } from 'express';
import { login as loginService } from './auth.service';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  try {
    const result = await loginService(email, password);
    return res.json(result);
  } catch (err: any) {
    const code = err?.code;
    if (code === 'USER_INACTIVE') {
      return res.status(403).json({ message: 'User is inactive' });
    }
    if (code === 'USER_NOT_FOUND' || code === 'INVALID_PASSWORD') {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
