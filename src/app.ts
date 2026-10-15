import fs from 'fs';
import path from 'path';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import router from './app/routes';
import globalErrorHandler from './app/middleware/globalErrorHandler';
import notFound from './app/middleware/notFound';
import { connectDB } from './app/DB/connection';

const app: Application = express();

// CORS must run before other middleware so browser preflight (OPTIONS)
// always receives Access-Control-Allow-Origin. Reflect the calling origin
// because credentialed requests cannot use a wildcard.
app.use(
  cors({
    origin: (requestOrigin, callback) => {
      callback(null, requestOrigin || true);
    },
    credentials: true,
  }),
);

// Parsers
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Ensure MongoDB is connected before processing any request (critical for Vercel serverless)
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    console.error('Failed to connect to MongoDB:', text);
    const message = text.includes('DATABASE_URL is not set')
      ? 'DATABASE_URL is missing on the server.'
      : /bad auth|authentication failed/i.test(text)
        ? 'MongoDB rejected the username or password.'
        : /whitelist|Could not connect|ENOTFOUND|querySrv|timed out/i.test(text)
          ? 'MongoDB Atlas blocked this server. Allow 0.0.0.0/0 in Network Access.'
          : 'Database connection failed. Please try again later.';
    res.status(503).json({
      success: false,
      message,
      errorSources: [{ path: '', message }],
    });
  }
});

// API routes
app.use('/api/v1', router);
app.use('/v1', router);

const staticDir = process.env.POS_STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

// Health check
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Baqalat Sheemah Khulaif Aayed Al-Enazi Lil-Mawad Al-Ghidha'iyyah Backend API is running",
    nameArabic: 'بقالة شيمه خليف عايد العنزي للمواد الغذائية',
    nameEnglish: "Baqalat Sheemah Khulaif Aayed Al-Enazi Lil-Mawad Al-Ghidha'iyyah",
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use(globalErrorHandler);

// Not found handler
app.use(notFound);

export default app;
