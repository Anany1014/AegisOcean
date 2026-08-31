import { describe, it, expect } from 'vitest';
import { fineCalculationService } from '../src/services/fine.service.js';

describe('Fine Calculation Service', () => {
  it('should calculate fine using base + area * multiplier', () => {
    const result = fineCalculationService.calculateFine(10, 1000, 500);
    expect(result.fineAmount).toBe(6000); // 1000 + 10 * 500
    expect(result.spillAreaSqKm).toBe(10);
    expect(result.baseFine).toBe(1000);
    expect(result.areaMultiplier).toBe(500);
  });

  it('should handle zero area properly', () => {
    const result = fineCalculationService.calculateFine(0, 1000, 500);
    expect(result.fineAmount).toBe(1000);
  });

  it('should throw error for negative area', () => {
    expect(() => fineCalculationService.calculateFine(-5, 1000, 500)).toThrow();
  });
});
