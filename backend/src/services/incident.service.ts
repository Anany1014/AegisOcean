import {
  ForensicAnchorPayload,
  IncidentRecord,
  IncidentStatus
} from '../types/incident.types.js';
import {
  AnchorResult,
  BlockchainClearanceResult,
  BlockchainEnforceResult,
  BlockchainSettlementResult,
  VerificationResult
} from '../types/blockchain.types.js';
import { config } from '../config/env.js';
import { evidenceManifestService, EvidenceManifestService } from './manifest.service.js';
import { ipfsService, IpfsService } from './ipfs.service.js';
import { blockchainService, BlockchainService } from './blockchain.service.js';
import { fineCalculationService, FineCalculationService } from './fine.service.js';
import { evidenceVerificationService, EvidenceVerificationService } from './verification.service.js';
import { NotFoundError, ConflictError, AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

export interface AnchorResponseData {
  incidentId: string;
  ipfsCID: string;
  evidenceHash: string;
  txHash: string;
  confirmationStatus: string;
  incidentIdBytes32: string;
  fineAmount: number;
  blockNumber?: number;
  explorerUrl: string;
  status: string;
  isIdempotent?: boolean;
  incident: IncidentRecord;
}

export interface EnforcementActionResponse {
  incidentId: string;
  incidentIdBytes32: string;
  status: IncidentStatus;
  txHash: string;
  blockNumber?: number;
  explorerUrl: string;
  fineAmount?: number;
  clearanceStatus: 'REVOKED' | 'RELEASED';
  incident: IncidentRecord;
}

export class IncidentService {
  private log = logger.forContext('IncidentService');
  private incidentStore: Map<string, IncidentRecord> = new Map();

  constructor(
    private customIpfsService?: IpfsService,
    private customBlockchainService?: BlockchainService,
    private customManifestService?: EvidenceManifestService,
    private customFineService?: FineCalculationService,
    private customVerificationService?: EvidenceVerificationService
  ) {}

  private getIpfs(): IpfsService {
    return this.customIpfsService || ipfsService;
  }

  private getBlockchain(): BlockchainService {
    return this.customBlockchainService || blockchainService;
  }

  private getManifestService(): EvidenceManifestService {
    return this.customManifestService || evidenceManifestService;
  }

  private getFineService(): FineCalculationService {
    return this.customFineService || fineCalculationService;
  }

  private getVerificationService(): EvidenceVerificationService {
    return this.customVerificationService || evidenceVerificationService;
  }

  /**
   * Resets in-memory store (for testing)
   */
  public clear(): void {
    this.incidentStore.clear();
  }

  /**
   * Complete flow:
   * 1. Receive forensic incident data
   * 2. Validate request & check duplicate
   * 3. Build canonical evidence manifest
   * 4. Calculate SHA-256 file hashes
   * 5. Pin evidence bundle to IPFS & retrieve CID
   * 6. Calculate evidenceHash
   * 7. Call MaritimeFineLedger.createIncident()
   * 8. Wait for tx confirmation & parse IncidentAnchored event
   * 9. Save all metadata in application database
   * 10. Return incidentId, ipfsCID, evidenceHash, txHash, confirmationStatus
   */
  public async anchorForensicIncident(
    payload: ForensicAnchorPayload
  ): Promise<AnchorResponseData> {
    // 1 & 2. Check for duplicate incidentId with idempotency check
    const existing = this.incidentStore.get(payload.incidentId);
    if (existing) {
      // Check if this is an idempotent retry with matching payload/evidenceHash
      const recomputedManifest = this.getManifestService().generateManifest(payload);
      const { evidenceHash: newHash } = this.getManifestService().computeManifestDigest(recomputedManifest);

      if (existing.evidenceHash.toLowerCase() === newHash.toLowerCase()) {
        this.log.info(`Idempotent anchoring request for already registered incident: ${payload.incidentId}`);
        return {
          incidentId: existing.incidentId,
          ipfsCID: existing.ipfsCID,
          evidenceHash: existing.evidenceHash,
          txHash: existing.anchorTxHash,
          confirmationStatus: 'Confirmed',
          incidentIdBytes32: existing.incidentIdBytes32,
          fineAmount: existing.fineAmount || 0,
          explorerUrl: `${config.BLOCK_EXPLORER_URL}/tx/${existing.anchorTxHash}`,
          status: existing.status,
          isIdempotent: true,
          incident: existing
        };
      }

      throw new ConflictError(
        `Incident '${payload.incidentId}' is already registered on AegisOcean ledger with different forensic evidence`
      );
    }

    this.log.info(`Processing forensic anchor for incident: ${payload.incidentId}`);

    // 3 & 4. Build canonical manifest and calculate per-file SHA-256
    const manifest = this.getManifestService().generateManifest(payload);
    const { evidenceHash } = this.getManifestService().computeManifestDigest(manifest);

    // 5 & 6. Pin evidence bundle to IPFS (If IPFS fails, do not proceed to blockchain)
    let ipfsResult;
    try {
      ipfsResult = await this.getIpfs().pinEvidenceBundle(manifest);
      if (!ipfsResult || !ipfsResult.ipfsCID) {
        throw new Error('IPFS pinning returned invalid CID');
      }
    } catch (ipfsError) {
      this.log.error(`IPFS pinning failed for incident ${payload.incidentId}`, {
        error: (ipfsError as Error).message
      });
      throw new AppError(`Evidence IPFS upload failed: ${(ipfsError as Error).message}`, 502);
    }

    // 7. Calculate statutory fine
    const fineResult = this.getFineService().calculateFine(payload.spillAreaSqKm);

    // 8 & 9. Call MaritimeFineLedger.createIncident() via server-side signer & wait for receipt
    let anchorResult: AnchorResult;
    try {
      anchorResult = await this.getBlockchain().createIncident({
        incidentId: payload.incidentId,
        suspectMMSI: payload.suspectMMSI,
        ipfsCID: ipfsResult.ipfsCID,
        evidenceHash,
        spillAreaSqKm: payload.spillAreaSqKm,
        attributionScore: payload.attributionScore
      });
    } catch (blockchainError) {
      this.log.error(`Blockchain anchoring transaction failed for ${payload.incidentId}`, {
        error: (blockchainError as Error).message,
        ipfsCID: ipfsResult.ipfsCID,
        evidenceHash
      });
      throw new AppError(
        `Blockchain transaction error during anchoring: ${(blockchainError as Error).message}`,
        500,
        {
          incidentId: payload.incidentId,
          ipfsCID: ipfsResult.ipfsCID,
          evidenceHash,
          retryable: true
        }
      );
    }

    // 10. Persist complete record in application database
    const incidentRecord: IncidentRecord = {
      incidentId: payload.incidentId,
      incidentIdBytes32: anchorResult.incidentIdBytes32,
      sourceSatellite: payload.sourceSatellite,
      sceneId: payload.sceneId,
      detectionTimestamp: payload.detectionTimestamp,
      spillAreaSqKm: payload.spillAreaSqKm,
      originTimeWindow: payload.originTimeWindow,
      originCoordinates: payload.originCoordinates,
      driftModelVersion: payload.driftModelVersion,
      aisDataRange: manifest.aisDataRange,
      suspectMMSI: payload.suspectMMSI,
      attributionScore: payload.attributionScore,
      softwareVersions: manifest.softwareVersions,
      ipfsCID: ipfsResult.ipfsCID,
      evidenceHash,
      fineAmount: fineResult.fineAmount,
      status: IncidentStatus.ANCHORED,
      anchorTxHash: anchorResult.txHash,
      createdAt: Math.floor(Date.now() / 1000),
      manifest
    };

    this.incidentStore.set(payload.incidentId, incidentRecord);
    this.log.info(`Incident successfully anchored and recorded: ${payload.incidentId}`);

    return {
      incidentId: payload.incidentId,
      ipfsCID: ipfsResult.ipfsCID,
      evidenceHash,
      txHash: anchorResult.txHash,
      confirmationStatus: 'Confirmed',
      incidentIdBytes32: anchorResult.incidentIdBytes32,
      fineAmount: fineResult.fineAmount,
      blockNumber: anchorResult.blockNumber,
      explorerUrl: anchorResult.explorerUrl,
      status: 'Anchored',
      incident: incidentRecord
    };
  }

  /**
   * Finds incident by bytes32 string (for blockchain event sync)
   */
  public findIncidentByBytes32(incidentIdBytes32: string): IncidentRecord | undefined {
    const normalized = incidentIdBytes32.toLowerCase();
    for (const record of this.incidentStore.values()) {
      if (
        record.incidentIdBytes32.toLowerCase() === normalized ||
        record.incidentId.toLowerCase() === normalized
      ) {
        return record;
      }
    }
    return undefined;
  }

  /**
   * Synchronizes and updates an incident from on-chain event emissions
   */
  public updateIncidentFromBlockchainEvent(params: {
    incidentId: string;
    incidentIdBytes32?: string;
    status?: IncidentStatus;
    txHash?: string;
    blockNumber?: number;
    fineAmount?: number;
    enforcedAt?: number;
  }): IncidentRecord | null {
    let record = this.incidentStore.get(params.incidentId);
    if (!record && params.incidentIdBytes32) {
      record = this.findIncidentByBytes32(params.incidentIdBytes32);
    }
    if (!record) {
      return null;
    }

    if (params.status) {
      record.status = params.status;
    }
    if (params.txHash) {
      if (params.status === IncidentStatus.ANCHORED) record.anchorTxHash = params.txHash;
      if (params.status === IncidentStatus.ENFORCED) record.enforceTxHash = params.txHash;
      if (params.status === IncidentStatus.SETTLED) record.settleTxHash = params.txHash;
    }
    if (params.fineAmount !== undefined) {
      record.fineAmount = params.fineAmount;
    }
    if (params.enforcedAt !== undefined) {
      record.enforcedAt = params.enforcedAt;
    }

    this.incidentStore.set(record.incidentId, record);
    this.log.info(`Updated incident ${record.incidentId} status to '${record.status}' from blockchain event`);
    return record;
  }

  /**
   * Retrieves an incident by ID from application storage
   */
  public async getIncident(incidentId: string): Promise<IncidentRecord> {
    const record = this.incidentStore.get(incidentId);
    if (!record) {
      throw new NotFoundError(`Incident with ID '${incidentId}' not found in AegisOcean records`);
    }
    return record;
  }

  /**
   * Lists all recorded incidents
   */
  public async listIncidents(): Promise<IncidentRecord[]> {
    return Array.from(this.incidentStore.values());
  }

  /**
   * Verifies the cryptographic chain of custody for an incident
   */
  public async verifyIncident(incidentId: string): Promise<VerificationResult> {
    const record = await this.getIncident(incidentId);
    return this.getVerificationService().verifyIncidentEvidence(record);
  }

  /**
   * Enforces fine on incident via on-chain contract call
   * Valid transition: ANCHORED -> ENFORCED
   */
  public async enforceFine(incidentId: string): Promise<EnforcementActionResponse> {
    const record = await this.getIncident(incidentId);

    if (record.status !== IncidentStatus.ANCHORED) {
      throw new ConflictError(
        `Invalid state transition: Cannot enforce fine on incident in '${record.status}' status (must be in 'ANCHORED' state)`
      );
    }

    let blockchainRes: BlockchainEnforceResult;
    try {
      blockchainRes = await this.getBlockchain().enforceFine(incidentId);
    } catch (err) {
      this.log.error(`Blockchain enforcement failed for incident ${incidentId}`, {
        error: (err as Error).message
      });
      throw new AppError(`Blockchain fine enforcement error: ${(err as Error).message}`, 500);
    }

    record.status = IncidentStatus.ENFORCED;
    record.enforcedAt = Math.floor(Date.now() / 1000);
    record.enforceTxHash = blockchainRes.txHash;
    this.incidentStore.set(incidentId, record);

    return {
      incidentId: record.incidentId,
      incidentIdBytes32: record.incidentIdBytes32,
      status: record.status,
      txHash: blockchainRes.txHash,
      blockNumber: blockchainRes.blockNumber,
      explorerUrl: blockchainRes.explorerUrl,
      fineAmount: record.fineAmount,
      clearanceStatus: 'REVOKED',
      incident: record
    };
  }

  /**
   * Records fine settlement on-chain
   * Valid transition: ENFORCED -> SETTLED
   */
  public async settleFine(incidentId: string): Promise<EnforcementActionResponse> {
    const record = await this.getIncident(incidentId);

    if (record.status !== IncidentStatus.ENFORCED) {
      throw new ConflictError(
        `Invalid state transition: Cannot settle fine for incident in '${record.status}' status (must be in 'ENFORCED' state)`
      );
    }

    let blockchainRes: BlockchainSettlementResult;
    try {
      blockchainRes = await this.getBlockchain().recordFineSettlement(incidentId);
    } catch (err) {
      this.log.error(`Blockchain settlement failed for incident ${incidentId}`, {
        error: (err as Error).message
      });
      throw new AppError(`Blockchain fine settlement error: ${(err as Error).message}`, 500);
    }

    record.status = IncidentStatus.SETTLED;
    record.settleTxHash = blockchainRes.txHash;
    this.incidentStore.set(incidentId, record);

    return {
      incidentId: record.incidentId,
      incidentIdBytes32: record.incidentIdBytes32,
      status: record.status,
      txHash: blockchainRes.txHash,
      blockNumber: blockchainRes.blockNumber,
      explorerUrl: blockchainRes.explorerUrl,
      fineAmount: record.fineAmount,
      clearanceStatus: 'REVOKED',
      incident: record
    };
  }

  /**
   * Releases port clearance after fine settlement on-chain
   * Valid transition: SETTLED -> RELEASED
   */
  public async releasePortClearance(incidentId: string): Promise<EnforcementActionResponse> {
    const record = await this.getIncident(incidentId);

    if (record.status !== IncidentStatus.SETTLED) {
      throw new ConflictError(
        `Invalid state transition: Cannot release port clearance before fine is settled (current status: '${record.status}')`
      );
    }

    let blockchainRes: BlockchainClearanceResult;
    try {
      blockchainRes = await this.getBlockchain().releasePortClearance(incidentId);
    } catch (err) {
      this.log.error(`Blockchain clearance release failed for incident ${incidentId}`, {
        error: (err as Error).message
      });
      throw new AppError(`Blockchain clearance release error: ${(err as Error).message}`, 500);
    }

    record.status = IncidentStatus.RELEASED;
    this.incidentStore.set(incidentId, record);

    return {
      incidentId: record.incidentId,
      incidentIdBytes32: record.incidentIdBytes32,
      status: record.status,
      txHash: blockchainRes.txHash,
      blockNumber: blockchainRes.blockNumber,
      explorerUrl: blockchainRes.explorerUrl,
      fineAmount: record.fineAmount,
      clearanceStatus: 'RELEASED',
      incident: record
    };
  }
}

export const incidentService = new IncidentService();
