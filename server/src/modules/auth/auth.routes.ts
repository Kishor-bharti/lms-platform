import { Router } from 'express';
import { z } from 'zod';
import { login, refresh } from './auth.controller';
import { loginRateLimiter } from '../../middlewares/rateLimit.middleware';
import { validateBody } from '../../middlewares/validate.middleware';

const router = Router();

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
	loginAs: z.enum(['admin', 'teacher', 'student']),
});

const refreshSchema = z.object({
	refreshToken: z.string(),
});

router.post('/login', validateBody(loginSchema), loginRateLimiter, login);
router.post('/refresh', validateBody(refreshSchema), refresh);

export default router;
