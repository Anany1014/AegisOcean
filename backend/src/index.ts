import { createApp } from './app.js';
import { config } from './config/env.js';
import { blockchainEventSyncService } from './services/eventSync.service.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(config.PORT, async () => {
  logger.info(`🌊 AegisOcean Backend Service running on port ${config.PORT}`);
  logger.info(`📡 Environment: ${config.NODE_ENV} | Chain: ${config.CHAIN_ID}`);
  logger.info(`🔗 API Base: http://localhost:${config.PORT}/api`);

  // Start the background blockchain event listener
  try {
    await blockchainEventSyncService.start();
  } catch (err) {
    logger.warn('Failed to start blockchain event listener on boot; will retry automatically in background', {
      error: (err as Error).message
    });
  }
});

const gracefulShutdown = async () => {
  logger.info('Shutting down server and blockchain event listeners...');
  await blockchainEventSyncService.stop();
  server.close(() => {
    logger.info('HTTP server closed cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;
