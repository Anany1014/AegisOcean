import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface FineCalculationResult {
  spillAreaSqKm: number;
  baseFine: number;
  areaMultiplier: number;
  fineAmount: number;
  currency: string;
}

export class FineCalculationService {
  private log = logger.forContext('FineCalculationService');

  /**
   * Calculates the statutory fine using the Base + Area * Multiplier model
   * Formula: fine = baseFine + (spillAreaSqKm * areaMultiplier)
   */
  public calculateFine(
    spillAreaSqKm: number,
    baseFine = config.DEFAULT_BASE_FINE,
    areaMultiplier = config.DEFAULT_AREA_MULTIPLIER
  ): FineCalculationResult {
    if (spillAreaSqKm < 0) {
      throw new Error('Spill area cannot be negative');
    }

    const fineAmount = baseFine + spillAreaSqKm * areaMultiplier;

    this.log.info(`Calculated statutory fine: ${fineAmount} for area ${spillAreaSqKm} sq km`, {
      baseFine,
      areaMultiplier,
      spillAreaSqKm,
      fineAmount
    });

    return {
      spillAreaSqKm,
      baseFine,
      areaMultiplier,
      fineAmount,
      currency: 'TESTNET_POL'
    };
  }
}

export const fineCalculationService = new FineCalculationService();
