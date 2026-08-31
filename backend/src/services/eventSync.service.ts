import { Contract, JsonRpcProvider, isHexString } from 'ethers';
import { config } from '../config/env.js';
import { MARITIME_FINE_LEDGER_ABI } from '../config/chain.js';
import { incidentService, IncidentService } from './incident.service.js';
import { IncidentStatus } from '../types/incident.types.js';
import { logger } from '../utils/logger.js';

export interface BlockchainEventSyncResult {
  eventType: string;
  incidentId: string;
  txHash: string;
  blockNumber?: number;
  status: 'PROCESSED' | 'SKIPPED_DUPLICATE' | 'UNKNOWN_INCIDENT' | 'ERROR';
  message: string;
}

export class BlockchainEventSyncService {
  private log = logger.forContext('BlockchainEventSyncService');
  private provider?: JsonRpcProvider;
  private contract?: Contract;
  private isRunning = false;
  private retryCount = 0;
  private reconnectTimeout?: NodeJS.Timeout;
  private processedEventKeys: Set<string> = new Set();

  constructor(
    private customIncidentService?: IncidentService,
    private customProvider?: JsonRpcProvider
  ) {}

  private getIncidentService(): IncidentService {
    return this.customIncidentService || incidentService;
  }

  /**
   * Resets processed events cache (for testing)
   */
  public clearProcessedCache(): void {
    this.processedEventKeys.clear();
  }

  /**
   * Generates a deterministic event idempotency key
   */
  public generateEventKey(
    eventType: string,
    txHash: string,
    logIndex: number | string = 0,
    incidentId: string
  ): string {
    return `${eventType}:${txHash.toLowerCase()}:${logIndex}:${incidentId.toLowerCase()}`;
  }

  /**
   * Checks if an event has already been processed
   */
  public isEventProcessed(eventKey: string): boolean {
    return this.processedEventKeys.has(eventKey);
  }

  /**
   * Starts the on-chain event listener
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.log.debug('Blockchain event sync service is already active');
      return;
    }

    if (config.NODE_ENV === 'test' && !this.customProvider) {
      this.log.info('Test environment: Event listener active in mock dispatch mode');
      this.isRunning = true;
      return;
    }

    try {
      this.provider = this.customProvider || new JsonRpcProvider(config.RPC_URL, config.CHAIN_ID);
      this.contract = new Contract(config.CONTRACT_ADDRESS, MARITIME_FINE_LEDGER_ABI, this.provider);

      this.log.info(`Connecting blockchain event sync to MaritimeFineLedger at ${config.CONTRACT_ADDRESS}...`);

      // Attach event listeners
      this.contract.on('IncidentAnchored', (incidentId, suspectMMSI, ipfsCID, evidenceHash, eventPayload) => {
        this.handleIncidentAnchoredEvent({
          incidentId,
          suspectMMSI,
          ipfsCID,
          evidenceHash,
          txHash: eventPayload?.log?.transactionHash || eventPayload?.transactionHash || '0xunknown',
          blockNumber: eventPayload?.log?.blockNumber || eventPayload?.blockNumber,
          logIndex: eventPayload?.log?.index || 0
        }).catch((err) => this.log.error('Error handling IncidentAnchored event', { error: err.message }));
      });

      this.contract.on('FineEnforced', (incidentId, fineAmount, eventPayload) => {
        this.handleFineEnforcedEvent({
          incidentId,
          fineAmount,
          txHash: eventPayload?.log?.transactionHash || eventPayload?.transactionHash || '0xunknown',
          blockNumber: eventPayload?.log?.blockNumber || eventPayload?.blockNumber,
          logIndex: eventPayload?.log?.index || 0
        }).catch((err) => this.log.error('Error handling FineEnforced event', { error: err.message }));
      });

      this.contract.on('PortClearanceRevoked', (incidentId, suspectMMSI, eventPayload) => {
        this.handlePortClearanceRevokedEvent({
          incidentId,
          suspectMMSI,
          txHash: eventPayload?.log?.transactionHash || eventPayload?.transactionHash || '0xunknown',
          blockNumber: eventPayload?.log?.blockNumber || eventPayload?.blockNumber,
          logIndex: eventPayload?.log?.index || 0
        }).catch((err) => this.log.error('Error handling PortClearanceRevoked event', { error: err.message }));
      });

      this.contract.on('FineSettled', (incidentId, amount, eventPayload) => {
        this.handleFineSettledEvent({
          incidentId,
          amount,
          txHash: eventPayload?.log?.transactionHash || eventPayload?.transactionHash || '0xunknown',
          blockNumber: eventPayload?.log?.blockNumber || eventPayload?.blockNumber,
          logIndex: eventPayload?.log?.index || 0
        }).catch((err) => this.log.error('Error handling FineSettled event', { error: err.message }));
      });

      this.contract.on('PortClearanceReleased', (incidentId, suspectMMSI, eventPayload) => {
        this.handlePortClearanceReleasedEvent({
          incidentId,
          suspectMMSI,
          txHash: eventPayload?.log?.transactionHash || eventPayload?.transactionHash || '0xunknown',
          blockNumber: eventPayload?.log?.blockNumber || eventPayload?.blockNumber,
          logIndex: eventPayload?.log?.index || 0
        }).catch((err) => this.log.error('Error handling PortClearanceReleased event', { error: err.message }));
      });

      this.isRunning = true;
      this.retryCount = 0;
      this.log.info('🌊 Blockchain event listener successfully attached and listening');
    } catch (error) {
      this.log.error(`Failed to start blockchain event listener: ${(error as Error).message}`);
      this.scheduleReconnect();
    }
  }

  /**
   * Reconnects with exponential backoff on RPC error / disconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    const backoffMs = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
    this.retryCount++;
    this.log.warn(`Scheduling blockchain RPC reconnect in ${backoffMs}ms (attempt #${this.retryCount})`);

    this.reconnectTimeout = setTimeout(() => {
      this.start();
    }, backoffMs);
  }

  /**
   * Stops the on-chain event listener
   */
  public async stop(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.contract) {
      this.contract.removeAllListeners();
    }
    this.isRunning = false;
    this.log.info('Blockchain event sync service stopped');
  }

  public isListening(): boolean {
    return this.isRunning;
  }

  // ==========================================
  // EVENT HANDLERS (IDEMPOTENT & ERROR-RESILIENT)
  // ==========================================

  /**
   * 1. Handles IncidentAnchored event
   */
  public async handleIncidentAnchoredEvent(params: {
    incidentId: string;
    suspectMMSI: bigint | number;
    ipfsCID: string;
    evidenceHash: string;
    txHash: string;
    blockNumber?: number;
    logIndex?: number;
  }): Promise<BlockchainEventSyncResult> {
    try {
      const { incidentId, txHash, blockNumber, logIndex = 0 } = params;
      const eventKey = this.generateEventKey('IncidentAnchored', txHash, logIndex, incidentId);

      if (this.isEventProcessed(eventKey)) {
        return {
          eventType: 'IncidentAnchored',
          incidentId,
          txHash,
          status: 'SKIPPED_DUPLICATE',
          message: 'Event already processed'
        };
      }

      this.log.info(`Processing IncidentAnchored event for: ${incidentId} (tx: ${txHash})`);

      const updated = this.getIncidentService().updateIncidentFromBlockchainEvent({
        incidentId,
        incidentIdBytes32: isHexString(incidentId, 32) ? incidentId : undefined,
        status: IncidentStatus.ANCHORED,
        txHash,
        blockNumber
      });

      this.processedEventKeys.add(eventKey);

      if (!updated) {
        this.log.warn(`IncidentAnchored event received for unknown incident ID: ${incidentId}`);
        return {
          eventType: 'IncidentAnchored',
          incidentId,
          txHash,
          blockNumber,
          status: 'UNKNOWN_INCIDENT',
          message: 'Incident record not found in local store'
        };
      }

      return {
        eventType: 'IncidentAnchored',
        incidentId: updated.incidentId,
        txHash,
        blockNumber,
        status: 'PROCESSED',
        message: 'Successfully synchronized IncidentAnchored event'
      };
    } catch (err) {
      this.log.error('Failed to process IncidentAnchored event', { error: (err as Error).message });
      return {
        eventType: 'IncidentAnchored',
        incidentId: params.incidentId,
        txHash: params.txHash,
        status: 'ERROR',
        message: (err as Error).message
      };
    }
  }

  /**
   * 2. Handles FineEnforced event
   */
  public async handleFineEnforcedEvent(params: {
    incidentId: string;
    fineAmount: bigint | number;
    txHash: string;
    blockNumber?: number;
    logIndex?: number;
  }): Promise<BlockchainEventSyncResult> {
    try {
      const { incidentId, fineAmount, txHash, blockNumber, logIndex = 0 } = params;
      const eventKey = this.generateEventKey('FineEnforced', txHash, logIndex, incidentId);

      if (this.isEventProcessed(eventKey)) {
        return {
          eventType: 'FineEnforced',
          incidentId,
          txHash,
          status: 'SKIPPED_DUPLICATE',
          message: 'Event already processed'
        };
      }

      this.log.info(`Processing FineEnforced event for ${incidentId} (fine: ${fineAmount})`);

      const updated = this.getIncidentService().updateIncidentFromBlockchainEvent({
        incidentId,
        incidentIdBytes32: isHexString(incidentId, 32) ? incidentId : undefined,
        status: IncidentStatus.ENFORCED,
        txHash,
        blockNumber,
        fineAmount: Number(fineAmount),
        enforcedAt: Math.floor(Date.now() / 1000)
      });

      this.processedEventKeys.add(eventKey);

      if (!updated) {
        this.log.warn(`FineEnforced event received for unknown incident ID: ${incidentId}`);
        return {
          eventType: 'FineEnforced',
          incidentId,
          txHash,
          status: 'UNKNOWN_INCIDENT',
          message: 'Incident record not found in local store'
        };
      }

      return {
        eventType: 'FineEnforced',
        incidentId: updated.incidentId,
        txHash,
        blockNumber,
        status: 'PROCESSED',
        message: 'Successfully synchronized FineEnforced event'
      };
    } catch (err) {
      this.log.error('Failed to process FineEnforced event', { error: (err as Error).message });
      return {
        eventType: 'FineEnforced',
        incidentId: params.incidentId,
        txHash: params.txHash,
        status: 'ERROR',
        message: (err as Error).message
      };
    }
  }

  /**
   * 3. Handles PortClearanceRevoked event
   */
  public async handlePortClearanceRevokedEvent(params: {
    incidentId: string;
    suspectMMSI: bigint | number;
    txHash: string;
    blockNumber?: number;
    logIndex?: number;
  }): Promise<BlockchainEventSyncResult> {
    try {
      const { incidentId, txHash, blockNumber, logIndex = 0 } = params;
      const eventKey = this.generateEventKey('PortClearanceRevoked', txHash, logIndex, incidentId);

      if (this.isEventProcessed(eventKey)) {
        return {
          eventType: 'PortClearanceRevoked',
          incidentId,
          txHash,
          status: 'SKIPPED_DUPLICATE',
          message: 'Event already processed'
        };
      }

      this.log.info(`Processing PortClearanceRevoked event for: ${incidentId}`);

      const updated = this.getIncidentService().updateIncidentFromBlockchainEvent({
        incidentId,
        incidentIdBytes32: isHexString(incidentId, 32) ? incidentId : undefined,
        status: IncidentStatus.ENFORCED,
        txHash,
        blockNumber
      });

      this.processedEventKeys.add(eventKey);

      if (!updated) {
        return {
          eventType: 'PortClearanceRevoked',
          incidentId,
          txHash,
          status: 'UNKNOWN_INCIDENT',
          message: 'Incident record not found in local store'
        };
      }

      return {
        eventType: 'PortClearanceRevoked',
        incidentId: updated.incidentId,
        txHash,
        blockNumber,
        status: 'PROCESSED',
        message: 'Successfully synchronized PortClearanceRevoked event'
      };
    } catch (err) {
      return {
        eventType: 'PortClearanceRevoked',
        incidentId: params.incidentId,
        txHash: params.txHash,
        status: 'ERROR',
        message: (err as Error).message
      };
    }
  }

  /**
   * 4. Handles FineSettled event
   */
  public async handleFineSettledEvent(params: {
    incidentId: string;
    amount: bigint | number;
    txHash: string;
    blockNumber?: number;
    logIndex?: number;
  }): Promise<BlockchainEventSyncResult> {
    try {
      const { incidentId, txHash, blockNumber, logIndex = 0 } = params;
      const eventKey = this.generateEventKey('FineSettled', txHash, logIndex, incidentId);

      if (this.isEventProcessed(eventKey)) {
        return {
          eventType: 'FineSettled',
          incidentId,
          txHash,
          status: 'SKIPPED_DUPLICATE',
          message: 'Event already processed'
        };
      }

      this.log.info(`Processing FineSettled event for: ${incidentId}`);

      const updated = this.getIncidentService().updateIncidentFromBlockchainEvent({
        incidentId,
        incidentIdBytes32: isHexString(incidentId, 32) ? incidentId : undefined,
        status: IncidentStatus.SETTLED,
        txHash,
        blockNumber
      });

      this.processedEventKeys.add(eventKey);

      if (!updated) {
        return {
          eventType: 'FineSettled',
          incidentId,
          txHash,
          status: 'UNKNOWN_INCIDENT',
          message: 'Incident record not found in local store'
        };
      }

      return {
        eventType: 'FineSettled',
        incidentId: updated.incidentId,
        txHash,
        blockNumber,
        status: 'PROCESSED',
        message: 'Successfully synchronized FineSettled event'
      };
    } catch (err) {
      return {
        eventType: 'FineSettled',
        incidentId: params.incidentId,
        txHash: params.txHash,
        status: 'ERROR',
        message: (err as Error).message
      };
    }
  }

  /**
   * 5. Handles PortClearanceReleased event
   */
  public async handlePortClearanceReleasedEvent(params: {
    incidentId: string;
    suspectMMSI: bigint | number;
    txHash: string;
    blockNumber?: number;
    logIndex?: number;
  }): Promise<BlockchainEventSyncResult> {
    try {
      const { incidentId, txHash, blockNumber, logIndex = 0 } = params;
      const eventKey = this.generateEventKey('PortClearanceReleased', txHash, logIndex, incidentId);

      if (this.isEventProcessed(eventKey)) {
        return {
          eventType: 'PortClearanceReleased',
          incidentId,
          txHash,
          status: 'SKIPPED_DUPLICATE',
          message: 'Event already processed'
        };
      }

      this.log.info(`Processing PortClearanceReleased event for: ${incidentId}`);

      const updated = this.getIncidentService().updateIncidentFromBlockchainEvent({
        incidentId,
        incidentIdBytes32: isHexString(incidentId, 32) ? incidentId : undefined,
        status: IncidentStatus.RELEASED,
        txHash,
        blockNumber
      });

      this.processedEventKeys.add(eventKey);

      if (!updated) {
        return {
          eventType: 'PortClearanceReleased',
          incidentId,
          txHash,
          status: 'UNKNOWN_INCIDENT',
          message: 'Incident record not found in local store'
        };
      }

      return {
        eventType: 'PortClearanceReleased',
        incidentId: updated.incidentId,
        txHash,
        blockNumber,
        status: 'PROCESSED',
        message: 'Successfully synchronized PortClearanceReleased event'
      };
    } catch (err) {
      return {
        eventType: 'PortClearanceReleased',
        incidentId: params.incidentId,
        txHash: params.txHash,
        status: 'ERROR',
        message: (err as Error).message
      };
    }
  }
}

export const blockchainEventSyncService = new BlockchainEventSyncService();
