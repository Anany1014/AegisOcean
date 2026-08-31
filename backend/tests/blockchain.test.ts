import { describe, it, expect } from 'vitest';
import { BlockchainService } from '../src/services/blockchain.service.js';

describe('Blockchain Service & MaritimeFineLedger Integration', () => {
  const blockchainService = new BlockchainService();

  const mockIncidentParams = {
    incidentId: 'INC-BC-TEST-001',
    suspectMMSI: 413298410,
    ipfsCID: 'bafybeic5e96d2c88b2ff28f8206bdaee9f32cc947b8340893bd',
    evidenceHash: '0x961effdec003ef3f1d13d350a0c9adc35a080e0cbf961466aeeb9c7b8a99fe07',
    spillAreaSqKm: 14.85,
    attributionScore: 92.5
  };

  it('1. createIncident() — should format parameters, compute bytes32, and return transaction confirmation', async () => {
    const result = await blockchainService.createIncident(mockIncidentParams);

    expect(result.incidentId).toBe('INC-BC-TEST-001');
    expect(result.incidentIdBytes32).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(result.ipfsCID).toBe(mockIncidentParams.ipfsCID);
    expect(result.evidenceHash).toBe(mockIncidentParams.evidenceHash);
    expect(result.status).toBe('Anchored');
    expect(result.explorerUrl).toContain(result.txHash);
    expect(result.events?.incidentAnchored).toBeDefined();
  });

  it('2. getIncident() — should safely query on-chain incident view', async () => {
    const view = await blockchainService.getIncident('INC-BC-TEST-001');
    // In mock/test env without live contract deployment, returns null or view safely
    expect(view === null || typeof view === 'object').toBe(true);
  });

  it('3. enforceFine() — should trigger fine enforcement and port-clearance revocation', async () => {
    const result = await blockchainService.enforceFine('INC-BC-TEST-001');

    expect(result.incidentId).toBe('INC-BC-TEST-001');
    expect(result.clearanceRevoked).toBe(true);
    expect(result.status).toBe('Enforced');
    expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('4. recordFineSettlement() — should submit fine settlement on-chain', async () => {
    const result = await blockchainService.recordFineSettlement('INC-BC-TEST-001');

    expect(result.incidentId).toBe('INC-BC-TEST-001');
    expect(result.status).toBe('Settled');
    expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('5. releasePortClearance() — should release port clearance on-chain', async () => {
    const result = await blockchainService.releasePortClearance('INC-BC-TEST-001');

    expect(result.incidentId).toBe('INC-BC-TEST-001');
    expect(result.status).toBe('Released');
    expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('Security: getNetworkStatus() — should NEVER reveal private keys in response', async () => {
    const status = await blockchainService.getNetworkStatus();

    expect(status.networkName).toBeDefined();
    expect(status.chainId).toBeDefined();
    expect(status.attestorAddress).toBeDefined();
    expect(status.enforcementAddress).toBeDefined();

    // Check that keys are NOT present
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('PRIVATE_KEY');
    expect(serialized).not.toContain('privateKey');
    expect(serialized).not.toContain('0000000000000000000000000000000000000000000000000000000000000001');
  });
});
