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
import topicsRouter     from './modules/topics/topics.routes';
import materialsRouter  from './modules/materials/materials.routes';
import profileRouter    from './modules/profile/profile.routes';
import uploadRouter            from './modules/upload/upload.routes';
import contentAssignmentsRouter from './modules/content-assignments/content-assignments.routes';
import studentUploadsRouter     from './modules/student-uploads/student-uploads.routes';
import { env }          from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import { httpLogger }   from './middlewares/httpLogger.middleware';
import { pool }         from './config/db';
import logger           from './config/logger';

const app = express();

app.set('trust proxy', 1);
// S3 presigned URLs use virtual-hosted-style: https://<bucket>.s3.<region>.amazonaws.com/...
const s3Origin = `https://*.s3.${env.AWS_REGION}.amazonaws.com`;

app.use(helmet({
  crossOriginEmbedderPolicy: false, // needed for Zoom iframes
  contentSecurityPolicy: env.NODE_ENV !== 'production'
    ? false  // disabled in dev — no restrictions
    : {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Allow images from self, S3 presigned URLs, and inline data URIs (base64 previews)
          'img-src': ["'self'", 'data:', s3Origin],
          // Allow Zoom iframes in production too
          'frame-src': ["'self'", 'https://zoom.us', 'https://*.zoom.us'],
        },
      },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(express.json());

const normalizeOrigin = (value?: string): string | undefined =>
  value ? value.replace(/\/+$/, '') : undefined;

const allowedOrigins =
  env.NODE_ENV === 'production'
    ? env.FRONTEND_ORIGINS.map(normalizeOrigin).filter(Boolean) as string[]
    : ['http://localhost:3000'];

logger.info(`[cors] Allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);

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

// HTTP access logging — must come before routes
app.use(httpLogger);

app.use('/api/auth',        authRouter);
app.use('/api/classes',     classesRouter);
app.use('/api/courses',     coursesRouter);
app.use('/api/admin',       adminRouter);
app.use('/api/quizzes',     quizRouter);
app.use('/api/assignments', assignmentRouter);
app.use('/api/progress',    progressRouter);
app.use('/api/subjects/:subjectId/topics', topicsRouter);
app.use('/api/materials',   materialsRouter);
app.use('/api/profile',     profileRouter);
app.use('/api/upload',              uploadRouter);
app.use('/api/content-assignments', contentAssignmentsRouter);
app.use('/api/student-uploads',    studentUploadsRouter);

app.get('/test-latency', async (_req, res) => {
  const start = Date.now();
  await pool.query('SELECT 1');
  res.json({ db_latency_ms: Date.now() - start });
});

app.use(errorHandler);

export default app;
