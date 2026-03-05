// Runs before every test file — sets env vars BEFORE dotenv.config() fires.
// dotenv does not overwrite already-set variables, so these values win.
process.env['NODE_ENV']             = 'test';
process.env['JWT_SECRET']           = 'test-jwt-secret-key-32-chars-min!!';
process.env['JWT_REFRESH_SECRET']   = 'test-refresh-secret-32-chars-min!!';
process.env['DATABASE_URL']         = 'postgresql://test:test@localhost:5432/lms_test';
process.env['ZOOM_ACCOUNT_ID']      = 'test-zoom-account';
process.env['ZOOM_CLIENT_ID']       = 'test-zoom-client';
process.env['ZOOM_CLIENT_SECRET']   = 'test-zoom-secret';
process.env['ZOOM_HOST_EMAIL']      = 'zoom@test.com';
