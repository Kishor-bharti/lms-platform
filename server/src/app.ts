import express from 'express';
import authRouter from './modules/auth/auth.routes';
import { env } from "./config/env";

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const origin = process.env.FRONTEND_ORIGIN || ""; // set to FRONTEND_URL
  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use('/api/auth', authRouter);

export default app;
