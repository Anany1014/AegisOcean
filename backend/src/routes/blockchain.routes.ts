import { Router } from 'express';
import { blockchainController } from '../controllers/blockchain.controller.js';

const router = Router();

// Get network and contract status
router.get('/status', blockchainController.getStatus.bind(blockchainController));

// Preview fine calculation
router.get('/calculate-fine', blockchainController.calculateFine.bind(blockchainController));

export default router;
