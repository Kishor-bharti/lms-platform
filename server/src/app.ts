import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRouter from './modules/auth/auth.routes';
import classesRouter from './modules/classes/classes.routes';
import { env } from './config/env';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(helmet());
app.use(express.json());

const allowedOrigin = env.FRONTEND_ORIGIN;
app.use(
  cors({
    origin(origin, callback) {
      if (!allowedOrigin) return callback(null, true);
      if (!origin) return callback(null, true);
      if (origin === allowedOrigin) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('/api/auth', authRouter);
app.use('/api/classes', classesRouter);

app.use(errorHandler);

export default app;
