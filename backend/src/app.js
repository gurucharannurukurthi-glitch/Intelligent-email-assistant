import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';

export function createApp() {
  const app = express();

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );

  // CORS configured strictly for frontend origin with credentials
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Trust reverse proxy (e.g. Render / Railway / Vercel / Cloudflare / AWS ALB)
  if (config.trustProxy) {
    const tp = typeof config.trustProxy === 'string' && !isNaN(config.trustProxy)
      ? parseInt(config.trustProxy, 10)
      : (config.trustProxy === 'true' ? true : config.trustProxy);
    app.set('trust proxy', tp);
  }

  // Session cookie settings
  const cookieOptions = {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  };

  if (config.cookieDomain) {
    cookieOptions.domain = config.cookieDomain;
  }

  // Session-based authentication stored in MongoDB
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: config.mongodbUri,
        collectionName: 'sessions',
        ttl: 7 * 24 * 60 * 60 // 7 days in seconds
      }),
      cookie: cookieOptions
    })
  );

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Intelligent Email Assistant Backend',
      environment: config.nodeEnv,
      timestamp: new Date().toISOString()
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/follow-ups', followUpRoutes);

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
