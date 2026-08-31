import { describe, it, expect, beforeEach } from 'vitest';
import { BlockchainEventSyncService } from '../src/services/eventSync.service.js';
import { IncidentService } from '../src/services/incident.service.js';
import { IncidentStatus, ForensicAnchorPayload } from '../src/types/incident.types.js';

describe('Blockchain Event Synchronization & Idempotency', () => {
  let incidentService: IncidentService;
  let eventSyncService: BlockchainEventSyncService;

  const mockPayload: ForensicAnchorPayload = {
    incidentId: 'INC-EVENT-SYNC-001',
    sourceSatellite: 'Sentinel-1A SAR',
    sceneId: 'S1A_EVENT_TEST',
    detectionTimestamp: 1788200000,
    spillAreaSqKm: 16.5,
    originTimeWindow: { start: 1788190000, end: 1788195000 },
    originCoordinates: { latitude: 18.9, longitude: 72.8 },
    driftModelVersion: 'OpenDrift-v2.1',
    suspectMMSI: 412345678,
    attributionScore: 92.0,
    files: [{ name: 'slick.geojson', contentBase64: Buffer.from('{}').toString('base64') }]
  };

  beforeEach(async () => {
    incidentService = new IncidentService();
    eventSyncService = new BlockchainEventSyncService(incidentService);

    // Initial anchor
    await incidentService.anchorForensicIncident(mockPayload);
  });

  // 1. IncidentAnchored Event
  it('should process IncidentAnchored event and update database record', async () => {
    const result = await eventSyncService.handleIncidentAnchoredEvent({
      incidentId: 'INC-EVENT-SYNC-001',
      suspectMMSI: 412345678n,
      ipfsCID: 'bafybeictestcid123',
      evidenceHash: '0x961effdec003ef3f1d13d350a0c9adc35a080e0cbf961466aeeb9c7b8a99fe07',
      txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      blockNumber: 10001,
      logIndex: 0
    });

    expect(result.status).toBe('PROCESSED');
    expect(result.eventType).toBe('IncidentAnchored');

    const incident = await incidentService.getIncident('INC-EVENT-SYNC-001');
    expect(incident.status).toBe(IncidentStatus.ANCHORED);
  });

  // 2. FineEnforced Event
  it('should process FineEnforced event and update status to ENFORCED with fine amount', async () => {
    const result = await eventSyncService.handleFineEnforcedEvent({
      incidentId: 'INC-EVENT-SYNC-001',
      fineAmount: 9250n,
      txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
      blockNumber: 10002,
      logIndex: 1
    });

    expect(result.status).toBe('PROCESSED');

    const incident = await incidentService.getIncident('INC-EVENT-SYNC-001');
    expect(incident.status).toBe(IncidentStatus.ENFORCED);
    expect(incident.fineAmount).toBe(9250);
  });

  // 3. PortClearanceRevoked Event
  it('should process PortClearanceRevoked event', async () => {
    const result = await eventSyncService.handlePortClearanceRevokedEvent({
      incidentId: 'INC-EVENT-SYNC-001',
      suspectMMSI: 412345678n,
      txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      blockNumber: 10003,
      logIndex: 2
    });

    expect(result.status).toBe('PROCESSED');
    const incident = await incidentService.getIncident('INC-EVENT-SYNC-001');
    expect(incident.status).toBe(IncidentStatus.ENFORCED);
  });

  // 4. FineSettled Event
  it('should process FineSettled event and update status to SETTLED', async () => {
    const result = await eventSyncService.handleFineSettledEvent({
      incidentId: 'INC-EVENT-SYNC-001',
      amount: 9250n,
      txHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
      blockNumber: 10004,
      logIndex: 3
    });

    expect(result.status).toBe('PROCESSED');
    const incident = await incidentService.getIncident('INC-EVENT-SYNC-001');
    expect(incident.status).toBe(IncidentStatus.SETTLED);
  });

  // 5. PortClearanceReleased Event
  it('should process PortClearanceReleased event and update status to RELEASED', async () => {
    const result = await eventSyncService.handlePortClearanceReleasedEvent({
      incidentId: 'INC-EVENT-SYNC-001',
      suspectMMSI: 412345678n,
      txHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
      blockNumber: 10005,
      logIndex: 4
    });

    expect(result.status).toBe('PROCESSED');
    const incident = await incidentService.getIncident('INC-EVENT-SYNC-001');
    expect(incident.status).toBe(IncidentStatus.RELEASED);
  });

  // 6. Idempotent Event Deduplication
  it('should skip duplicate events without mutating database state', async () => {
    const eventParams = {
      incidentId: 'INC-EVENT-SYNC-001',
      fineAmount: 9250n,
      txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
      blockNumber: 10002,
      logIndex: 1
    };

    const firstRun = await eventSyncService.handleFineEnforcedEvent(eventParams);
    expect(firstRun.status).toBe('PROCESSED');

    // Duplicate delivery
    const secondRun = await eventSyncService.handleFineEnforcedEvent(eventParams);
    expect(secondRun.status).toBe('SKIPPED_DUPLICATE');
  });

  // 7. Unknown Incident ID Handling
  it('should handle events for unknown incident IDs gracefully without throwing', async () => {
    const result = await eventSyncService.handleFineEnforcedEvent({
      incidentId: 'INC-UNKNOWN-999',
      fineAmount: 5000n,
      txHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
      blockNumber: 10009,
      logIndex: 0
    });

    expect(result.status).toBe('UNKNOWN_INCIDENT');
  });

  // 8. Lifecycle Management
  it('should start and stop event sync service cleanly', async () => {
    await eventSyncService.start();
    expect(eventSyncService.isListening()).toBe(true);

    await eventSyncService.stop();
    expect(eventSyncService.isListening()).toBe(false);
  });
});
