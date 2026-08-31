import { Router } from 'express';
import incidentRoutes from './incident.routes.js';
import blockchainRoutes from './blockchain.routes.js';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'AegisOcean Backend',
    timestamp: new Date().toISOString()
  });
});

// Mount module routers
router.use('/incidents', incidentRoutes);
router.use('/blockchain', blockchainRoutes);

export default router;
