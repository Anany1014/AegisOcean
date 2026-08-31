import { Request, Response, NextFunction } from 'express';
import { blockchainService } from '../services/blockchain.service.js';
import { fineCalculationService } from '../services/fine.service.js';

export class BlockchainController {
  public async getStatus(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const status = await blockchainService.getNetworkStatus();
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  public async calculateFine(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const area = parseFloat(req.query.area as string);
      if (isNaN(area)) {
        res.status(400).json({
          success: false,
          error: { message: 'Query parameter "area" must be a valid number' }
        });
        return;
      }
      const result = fineCalculationService.calculateFine(area);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const blockchainController = new BlockchainController();
