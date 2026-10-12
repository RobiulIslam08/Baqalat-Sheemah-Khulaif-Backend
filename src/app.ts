import fs from 'fs';
import path from 'path';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import router from './app/routes';
import globalErrorHandler from './app/middleware/globalErrorHandler';
import notFound from './app/middleware/notFound';
import config from './app/config';
import { connectDB } from './app/DB/connection';

const app: Application = express();

// Parsers
app.use(express.json());
app.use(cookieParser());
const desktop = process.env.POS_DESKTOP === '1';
const port = process.env.PORT || '47211';
const origins = desktop
  ? [`http://127.0.0.1:${port}`, `http://localhost:${port}`]
  : [
      config.frontend_url as string,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:6100',
      'http://localhost:6200',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:6100',
      'http://127.0.0.1:6200',
    ].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (origins.includes(origin) || origin.endsWith('.loca.lt') || origin.endsWith('.ngrok.io')) {
        return callback(null, true);
      }
      // For localhost or cPanel deployments
      return callback(null, true);
    },
    credentials: true,
  }),
);

// Ensure MongoDB is connected before processing any request (critical for Vercel serverless)
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Failed to open the local database:', err);
    res.status(503).json({
      success: false,
      message: 'Database connection failed. Please try again later.',
      errorSources: [{ path: '', message: 'Database connection failed' }],
    });
  }
});

// API routes
app.use('/api/v1', router);

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
