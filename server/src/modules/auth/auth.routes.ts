import { Router } from 'express';
import { z } from 'zod';
import { login } from './auth.controller';
import { loginRateLimiter } from '../../middlewares/rateLimit.middleware';
import { validateBody } from '../../middlewares/validate.middleware';

const router = Router();

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
	loginAs: z.enum(['admin', 'teacher', 'student']),
});

router.post('/login', validateBody(loginSchema), loginRateLimiter, login);

export default router;
