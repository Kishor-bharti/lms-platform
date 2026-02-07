import app from './app';
import { env } from './config/env';

const requiredZoom = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'];
for (const key of requiredZoom) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const port = env.PORT || 4000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
