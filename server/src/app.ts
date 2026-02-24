import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRouter       from './modules/auth/auth.routes';
import classesRouter    from './modules/classes/classes.routes';
import coursesRouter    from './modules/courses/courses.routes';
import adminRouter      from './modules/admin/admin.routes';
import quizRouter       from './modules/quiz/quiz.routes';
import assignmentRouter from './modules/assignment/assignment.routes';
import progressRouter   from './modules/progress/progress.routes';
import materialsRouter  from './modules/materials/materials.routes';
import profileRouter    from './modules/profile/profile.routes';
import { env }          from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import { pool }         from './config/db';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());

const normalizeOrigin = (value?: string): string | undefined =>
  value ? value.replace(/\/+$/, '') : undefined;

const allowedOrigins =
  env.NODE_ENV === 'production'
    ? env.FRONTEND_ORIGINS.map(normalizeOrigin).filter(Boolean) as string[]
    : ['http://localhost:3000','https://viewer-second-phantom-jeremy.trycloudflare.com'];

console.info(`[cors] Allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = normalizeOrigin(origin);
    if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use('/api/auth',        authRouter);
app.use('/api/classes',     classesRouter);
app.use('/api/courses',     coursesRouter);
app.use('/api/admin',       adminRouter);
app.use('/api/quizzes',     quizRouter);
app.use('/api/assignments', assignmentRouter);
app.use('/api/progress',    progressRouter);
app.use('/api/materials',   materialsRouter);
app.use('/api/profile',     profileRouter);

app.get('/test-latency', async (req, res) => {
  const start = Date.now();
  await pool.query('SELECT 1');
  res.json({ db_latency_ms: Date.now() - start });
});

app.use(errorHandler);

export default app;
