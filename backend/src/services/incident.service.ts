import {
  ForensicAnchorPayload,
  IncidentRecord,
  IncidentStatus,
  MLForensicPayload
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
  ) {
    this.seedIndianIncidents();
  }

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

  private seedIndianIncidents(): void {
    const seeds: Array<{
      id: string;
      detectedAt: string;
      lat: number;
      lon: number;
      polygon: number[][];
      areaKm2: number;
      par: number;
      windConf: number;
      suspectMMSI: number;
      status: IncidentStatus;
    }> = [
      {
        id: 'INC-IND-MUMBAI-01',
        detectedAt: '2026-08-28T04:15:00Z',
        lat: 19.35, lon: 71.95,
        polygon: [[71.85, 19.35], [71.95, 19.42], [72.05, 19.38], [71.98, 19.28], [71.88, 19.26], [71.85, 19.35]],
        areaKm2: 28.4, par: 0.28, windConf: 0.08, suspectMMSI: 419001234, status: IncidentStatus.ANCHORED
      },
      {
        id: 'INC-IND-KUTCH-02',
        detectedAt: '2026-08-29T11:20:00Z',
        lat: 22.40, lon: 68.90,
        polygon: [[68.80, 22.40], [68.92, 22.48], [69.02, 22.42], [68.95, 22.32], [68.82, 22.33], [68.80, 22.40]],
        areaKm2: 34.6, par: 0.22, windConf: 0.04, suspectMMSI: 419000123, status: IncidentStatus.ANCHORED
      },
      {
        id: 'INC-IND-GOA-03',
        detectedAt: '2026-08-30T06:45:00Z',
        lat: 15.65, lon: 73.22,
        polygon: [[73.15, 15.65], [73.24, 15.72], [73.32, 15.68], [73.28, 15.58], [73.18, 15.56], [73.15, 15.65]],
        areaKm2: 16.2, par: 0.35, windConf: 0.11, suspectMMSI: 419000456, status: IncidentStatus.ANCHORED
      },
      {
        id: 'INC-IND-KOCHI-04',
        detectedAt: '2026-08-30T16:10:00Z',
        lat: 9.45, lon: 75.88,
        polygon: [[75.80, 9.45], [75.90, 9.52], [75.98, 9.48], [75.92, 9.38], [75.82, 9.36], [75.80, 9.45]],
        areaKm2: 19.8, par: 0.31, windConf: 0.09, suspectMMSI: 419002100, status: IncidentStatus.ENFORCED
      },
      {
        id: 'INC-IND-CHENNAI-05',
        detectedAt: '2026-08-31T02:30:00Z',
        lat: 13.25, lon: 80.65,
        polygon: [[80.55, 13.25], [80.68, 13.32], [80.76, 13.26], [80.69, 13.16], [80.58, 13.15], [80.55, 13.25]],
        areaKm2: 24.1, par: 0.26, windConf: 0.06, suspectMMSI: 419002678, status: IncidentStatus.ANCHORED
      },
      {
        id: 'INC-IND-VIZAG-06',
        detectedAt: '2026-08-31T09:00:00Z',
        lat: 17.50, lon: 83.70,
        polygon: [[83.60, 17.50], [83.72, 17.58], [83.82, 17.52], [83.75, 17.42], [83.64, 17.40], [83.60, 17.50]],
        areaKm2: 31.5, par: 0.24, windConf: 0.05, suspectMMSI: 419001012, status: IncidentStatus.ENFORCED
      },
      {
        id: 'INC-IND-PARADIP-07',
        detectedAt: '2026-08-31T15:20:00Z',
        lat: 20.15, lon: 86.95,
        polygon: [[86.85, 20.15], [86.96, 20.24], [87.05, 20.18], [86.98, 20.08], [86.88, 20.06], [86.85, 20.15]],
        areaKm2: 42.0, par: 0.19, windConf: 0.03, suspectMMSI: 419001567, status: IncidentStatus.ANCHORED
      },
      {
        id: 'INC-IND-PALK-08',
        detectedAt: '2026-08-31T20:00:00Z',
        lat: 9.15, lon: 79.92,
        polygon: [[79.85, 9.15], [79.94, 9.22], [80.02, 9.18], [79.96, 9.08], [79.86, 9.06], [79.85, 9.15]],
        areaKm2: 11.7, par: 0.44, windConf: 0.14, suspectMMSI: 419000789, status: IncidentStatus.ANCHORED
      }
    ];

    for (const s of seeds) {
      this.incidentStore.set(s.id, {
        incidentId: s.id,
        incidentIdBytes32: '0x' + Buffer.from(s.id.padEnd(32, '0')).toString('hex').slice(0, 64),
        sourceSatellite: 'SAR-Sentinel-1',
        sceneId: `scene-${s.id}`,
        detectionTimestamp: Math.floor(new Date(s.detectedAt).getTime() / 1000),
        spillAreaSqKm: s.areaKm2,
        originTimeWindow: { start: Math.floor(new Date(s.detectedAt).getTime() / 1000) - 21600, end: Math.floor(new Date(s.detectedAt).getTime() / 1000) },
        originCoordinates: { latitude: s.lat, longitude: s.lon },
        driftModelVersion: 'AegisOcean-ML-1.0',
        aisDataRange: `auto-${s.detectedAt}`,
        suspectMMSI: s.suspectMMSI,
        attributionScore: 88,
        softwareVersions: {
          sarSegmentation: 'AegisOcean-Stage2-1.0',
          aisEngine: 'AegisOcean-LSTM-1.0',
          hydrodynamicEngine: 'AegisOcean-Drift-1.0',
        },
        ipfsCID: `bafybeic${s.id.toLowerCase().replace(/[^a-z0-9]/g, '')}mockipfs`,
        evidenceHash: `0x${Buffer.from(s.id).toString('hex').padEnd(64, '0')}`,
        fineAmount: s.areaKm2 * 1250,
        status: s.status,
        anchorTxHash: `0x${Buffer.from('tx-' + s.id).toString('hex').padEnd(64, '0')}`,
        createdAt: Math.floor(new Date(s.detectedAt).getTime() / 1000),
        manifest: {} as any
      });
    }
  }

  /**
   * Resets in-memory store (for testing)
   */
  public clear(): void {
    this.incidentStore.clear();
  }

  /**
   * Complete flow:
   * Supports both ForensicAnchorPayload and simplified MLForensicPayload.
   */
  public async anchorForensicIncident(
    payload: ForensicAnchorPayload | MLForensicPayload
  ): Promise<AnchorResponseData> {
    // If it's a simplified ML payload, transform to formal payload
    if ('spillPolygon' in payload) {
      const mlPayload = payload as MLForensicPayload;
      const now = Date.now();
      const incidentId = `ml-inc-${mlPayload.suspectMMSI}-${now}`;
      const lons = mlPayload.spillPolygon.map(c => c[0]);
      const lats = mlPayload.spillPolygon.map(c => c[1]);
      const lon = lons.reduce((a, b) => a + b, 0) / (lons.length || 1);
      const lat = lats.reduce((a, b) => a + b, 0) / (lats.length || 1);

      const formal: ForensicAnchorPayload = {
        incidentId,
        sourceSatellite: 'SAR-Sentinel-1',
        sceneId: `auto-${incidentId}`,
        detectionTimestamp: Math.floor(now / 1000),
        spillAreaSqKm: mlPayload.spillAreaSqKm,
        originTimeWindow: { start: Math.floor(now / 1000) - 21600, end: Math.floor(now / 1000) },
        originCoordinates: { latitude: lat, longitude: lon },
        driftModelVersion: 'AegisOcean-ML-1.0',
        aisDataRange: `auto-${new Date(now).toISOString()}`,
        suspectMMSI: mlPayload.suspectMMSI,
        attributionScore: mlPayload.attributionScore,
        softwareVersions: {
          sarSegmentation: 'AegisOcean-Stage2-1.0',
          aisEngine: 'AegisOcean-LSTM-1.0',
          hydrodynamicEngine: 'AegisOcean-Drift-1.0',
        },
        files: [
          {
            name: 'sar_classification.json',
            contentBase64: Buffer.from(JSON.stringify(mlPayload.sarClassification)).toString('base64'),
            mimeType: 'application/json',
          },
          {
            name: 'characterisation.json',
            contentBase64: Buffer.from(JSON.stringify(mlPayload.characterisation)).toString('base64'),
            mimeType: 'application/json',
          },
          {
            name: 'suspect_scores.json',
            contentBase64: Buffer.from(JSON.stringify(mlPayload.suspectScores)).toString('base64'),
            mimeType: 'application/json',
          },
        ],
      };
      return this.anchorForensicIncident(formal);
    }

    const formalPayload = payload as ForensicAnchorPayload;

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
