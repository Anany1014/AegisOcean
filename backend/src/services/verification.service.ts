import { CanonicalEvidenceManifest, IncidentRecord } from '../types/incident.types.js';
import { VerificationResult } from '../types/blockchain.types.js';
import { evidenceManifestService, EvidenceManifestService } from './manifest.service.js';
import { ipfsService, IpfsService } from './ipfs.service.js';
import { blockchainService, BlockchainService } from './blockchain.service.js';
import { logger } from '../utils/logger.js';

export class EvidenceVerificationService {
  private log = logger.forContext('EvidenceVerificationService');

  constructor(
    private customIpfsService?: IpfsService,
    private customBlockchainService?: BlockchainService,
    private customManifestService?: EvidenceManifestService
  ) {}

  private getIpfsService(): IpfsService {
    return this.customIpfsService || ipfsService;
  }

  private getBlockchainService(): BlockchainService {
    return this.customBlockchainService || blockchainService;
  }

  private getManifestService(): EvidenceManifestService {
    return this.customManifestService || evidenceManifestService;
  }

  /**
   * Complete verification pipeline for an incident:
   * 1. Retrieve the incident from local store
   * 2. Retrieve the IPFS CID
   * 3. Retrieve the evidence bundle from IPFS (with fallback to local bundle)
   * 4. Reconstruct the canonical evidence manifest
   * 5. Calculate evidenceHash
   * 6. Retrieve expected evidenceHash from blockchain
   * 7. Compare both hashes and return MATCH or MISMATCH
   */
  public async verifyIncidentEvidence(
    incident: IncidentRecord
  ): Promise<VerificationResult> {
    const { incidentId, ipfsCID, evidenceHash: localExpectedHash, manifest: localManifest } = incident;

    this.log.info(`Initiating evidence verification for incident: ${incidentId} (CID: ${ipfsCID})`);

    // 1. Validate IPFS CID presence
    if (!ipfsCID || ipfsCID.trim() === '') {
      return {
        incidentId,
        ipfsCID: 'MISSING_CID',
        calculatedEvidenceHash: 'N/A',
        onChainEvidenceHash: localExpectedHash || 'N/A',
        result: 'MISMATCH',
        verified: false,
        details: 'Incident is missing an IPFS CID reference',
        timestamp: new Date().toISOString()
      };
    }

    // 2. Fetch on-chain recorded hash from smart contract
    let onChainEvidenceHash = localExpectedHash;
    try {
      const onChainRecord = await this.getBlockchainService().getIncident(incidentId);
      if (onChainRecord?.evidenceHash && onChainRecord.evidenceHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        onChainEvidenceHash = onChainRecord.evidenceHash;
      }
    } catch (bcError) {
      this.log.warn(`Could not read on-chain incident for verification: ${(bcError as Error).message}`);
    }

    // 3. Resolve manifest from IPFS
    let manifestToVerify: CanonicalEvidenceManifest | null = null;
    try {
      manifestToVerify = await this.getIpfsService().fetchEvidenceManifest(ipfsCID);
    } catch (ipfsErr) {
      this.log.warn(`IPFS resolution failed for CID ${ipfsCID}: ${(ipfsErr as Error).message}`);
    }

    // Use local manifest as fallback if gateway query is offline/mock
    if (!manifestToVerify) {
      manifestToVerify = localManifest;
    }

    if (!manifestToVerify) {
      return {
        incidentId,
        ipfsCID,
        calculatedEvidenceHash: 'UNRESOLVABLE_IPFS_CONTENT',
        onChainEvidenceHash,
        result: 'MISMATCH',
        verified: false,
        details: 'Failed to retrieve evidence bundle from IPFS gateway',
        timestamp: new Date().toISOString()
      };
    }

    // 4 & 5. Reconstruct canonical manifest and calculate evidenceHash
    let calculatedEvidenceHash: string;
    try {
      const digest = this.getManifestService().computeManifestDigest(manifestToVerify);
      calculatedEvidenceHash = digest.evidenceHash;
    } catch (manifestError) {
      return {
        incidentId,
        ipfsCID,
        calculatedEvidenceHash: 'MALFORMED_MANIFEST',
        onChainEvidenceHash,
        result: 'MISMATCH',
        verified: false,
        details: `Evidence manifest reconstruction failed: ${(manifestError as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }

    // 6 & 7. Compare hashes
    const isMatch = calculatedEvidenceHash.toLowerCase() === onChainEvidenceHash.toLowerCase();
    const result: 'MATCH' | 'MISMATCH' = isMatch ? 'MATCH' : 'MISMATCH';

    this.log.info(`Verification evaluation for ${incidentId}: ${result}`, {
      calculatedEvidenceHash,
      onChainEvidenceHash,
      isMatch
    });

    return {
      incidentId,
      ipfsCID,
      calculatedEvidenceHash,
      onChainEvidenceHash,
      calculatedHash: calculatedEvidenceHash,
      onChainHash: onChainEvidenceHash,
      result,
      verified: isMatch,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Directly verifies an in-memory or raw manifest against a target hash
   */
  public async verifyManifestAgainstHash(
    incidentId: string,
    expectedEvidenceHash: string,
    manifest: CanonicalEvidenceManifest,
    ipfsCID?: string
  ): Promise<VerificationResult> {
    const { evidenceHash: calculatedHash } = this.getManifestService().computeManifestDigest(manifest);
    const isMatch = calculatedHash.toLowerCase() === expectedEvidenceHash.toLowerCase();
    const result: 'MATCH' | 'MISMATCH' = isMatch ? 'MATCH' : 'MISMATCH';

    return {
      incidentId,
      ipfsCID: ipfsCID || 'N/A',
      calculatedEvidenceHash: calculatedHash,
      onChainEvidenceHash: expectedEvidenceHash,
      calculatedHash,
      onChainHash: expectedEvidenceHash,
      result,
      verified: isMatch,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Resolves manifest directly from IPFS by CID and verifies against on-chain hash
   */
  public async verifyFromIpfsCid(
    incidentId: string,
    ipfsCID: string,
    expectedEvidenceHash: string,
    localManifestFallback?: CanonicalEvidenceManifest
  ): Promise<VerificationResult> {
    const fetchedManifest = await this.getIpfsService().fetchEvidenceManifest(ipfsCID);
    const manifestToVerify = fetchedManifest || localManifestFallback;

    if (!manifestToVerify) {
      return {
        incidentId,
        ipfsCID,
        calculatedEvidenceHash: 'UNRESOLVABLE_IPFS_CID',
        onChainEvidenceHash: expectedEvidenceHash,
        calculatedHash: 'UNRESOLVABLE_IPFS_CID',
        onChainHash: expectedEvidenceHash,
        result: 'MISMATCH',
        verified: false,
        timestamp: new Date().toISOString()
      };
    }

    return this.verifyManifestAgainstHash(
      incidentId,
      expectedEvidenceHash,
      manifestToVerify,
      ipfsCID
    );
  }
}

export const evidenceVerificationService = new EvidenceVerificationService();
