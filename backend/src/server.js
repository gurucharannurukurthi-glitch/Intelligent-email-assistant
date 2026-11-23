import { config, validateEnv } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

async function startServer() {
  validateEnv();

  try {
    await connectDB();
  } catch (err) {
    console.error('[Startup] Failed to connect to database:', err.message);
    console.error('[Startup] Please ensure MongoDB is running or MONGODB_URI is configured.');
    // We continue with server startup so health checks or config errors can still report
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(`  Intelligent Email Assistant Backend    `);
    console.log(`  Server running on http://localhost:${config.port}`);
    console.log(`  Environment: ${config.nodeEnv}          `);
    console.log(`  Frontend URL: ${config.frontendUrl}    `);
    console.log(`=========================================`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] Process terminated.');
      process.exit(0);
    });
  });
}

startServer();
