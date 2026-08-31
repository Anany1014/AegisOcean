import { config } from '../config/env.js';
import { CanonicalEvidenceManifest } from '../types/incident.types.js';
import { canonicalizeJson, computeSha256 } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

export interface IpfsPinResult {
  ipfsCID: string;
  pinSize: number;
  timestamp: string;
  gatewayUrl: string;
  isMock: boolean;
}

export class IpfsService {
  private log = logger.forContext('IpfsService');
  private gateway: string;
  private apiKey?: string;
  private secretKey?: string;
  private jwt?: string;

  constructor(opts?: {
    apiKey?: string;
    secretKey?: string;
    jwt?: string;
    gateway?: string;
  }) {
    this.apiKey = opts?.apiKey ?? (config.PINATA_API_KEY || undefined);
    this.secretKey = opts?.secretKey ?? (config.PINATA_SECRET_KEY || undefined);
    this.jwt = opts?.jwt ?? (config.PINATA_JWT || undefined);
    this.gateway = opts?.gateway ?? config.IPFS_GATEWAY;
  }

  private hasValidPinataCredentials(): boolean {
    if (config.NODE_ENV === 'test') {
      return false;
    }
    if (this.jwt && this.jwt.length > 20 && !this.jwt.startsWith('mock_') && !this.jwt.startsWith('your_')) {
      return true;
    }
    if (
      this.apiKey &&
      this.secretKey &&
      this.apiKey.length > 5 &&
      this.secretKey.length > 5 &&
      !this.apiKey.startsWith('mock_') &&
      !this.apiKey.startsWith('your_') &&
      !this.secretKey.startsWith('mock_') &&
      !this.secretKey.startsWith('your_')
    ) {
      return true;
    }
    return false;
  }

  private getPinataHeaders(): Record<string, string> {
    if (this.jwt && !this.jwt.startsWith('mock_')) {
      return {
        Authorization: `Bearer ${this.jwt}`,
        'Content-Type': 'application/json'
      };
    }
    return {
      pinata_api_key: this.apiKey || '',
      pinata_secret_api_key: this.secretKey || '',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Pins an evidence manifest and bundle to IPFS via Pinata
   */
  public async pinEvidenceBundle(
    manifest: CanonicalEvidenceManifest
  ): Promise<IpfsPinResult> {
    const canonicalJson = canonicalizeJson(manifest);
    const manifestHash = computeSha256(canonicalJson);

    // If valid Pinata credentials are configured, execute real Pinata API call
    if (this.hasValidPinataCredentials()) {
      try {
        this.log.info(`Pinning evidence manifest for incident ${manifest.incidentId} to Pinata IPFS`);

        const body = {
          pinataOptions: {
            cidVersion: 1
          },
          pinataMetadata: {
            name: `AegisOcean-Incident-${manifest.incidentId}`,
            keyvalues: {
              incidentId: manifest.incidentId,
              suspectMMSI: String(manifest.suspectMMSI),
              detectionTimestamp: String(manifest.detectionTimestamp)
            }
          },
          pinataContent: JSON.parse(canonicalJson)
        };

        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: this.getPinataHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Pinata API returned ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as {
          IpfsHash: string;
          PinSize: number;
          Timestamp: string;
        };

        this.log.info(`Successfully pinned to Pinata IPFS: ${data.IpfsHash}`);

        return {
          ipfsCID: data.IpfsHash,
          pinSize: data.PinSize,
          timestamp: data.Timestamp || new Date().toISOString(),
          gatewayUrl: `${this.gateway}${data.IpfsHash}`,
          isMock: false
        };
      } catch (error) {
        this.log.warn(`Pinata pinning request failed; falling back to deterministic IPFS CID`, {
          error: (error as Error).message
        });
      }
    }

    // Deterministic IPFS CID v1 (Base32 style) for development, unit testing, and offline environments
    const mockCid = `bafybeic${manifestHash.slice(0, 51)}`;
    const pinSize = Buffer.byteLength(canonicalJson, 'utf8');
    const timestamp = new Date().toISOString();

    this.log.info(`Pinned evidence package using deterministic CID (${mockCid})`);

    return {
      ipfsCID: mockCid,
      pinSize,
      timestamp,
      gatewayUrl: `${this.gateway}${mockCid}`,
      isMock: true
    };
  }

  /**
   * Resolves content from IPFS Gateway by CID.
   * SEC-LOW-02: CID format is validated before URL construction.
   */
  public async fetchEvidenceManifest(ipfsCID: string): Promise<CanonicalEvidenceManifest | null> {
    if (config.NODE_ENV === 'test') {
      return null;
    }

    // Validate CID format before using it in URLs (CIDv0: Qm..., CIDv1: bafy... or bafk...)
    const validCidPattern = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{56})$/;
    if (!validCidPattern.test(ipfsCID)) {
      this.log.warn(`Refusing to resolve malformed or invalid IPFS CID: ${ipfsCID.slice(0, 20)}...`);
      return null;
    }

    const gateways = [
      `${this.gateway}${ipfsCID}`,
      `https://gateway.pinata.cloud/ipfs/${ipfsCID}`,
      `https://ipfs.io/ipfs/${ipfsCID}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsCID}`
    ];

    for (const url of gateways) {
      try {
        const response = await fetch(url, {
          headers: this.jwt && !this.jwt.startsWith('mock_') ? { Authorization: `Bearer ${this.jwt}` } : {},
          signal: AbortSignal.timeout(2000)
        });

        if (response.ok) {
          const manifest = (await response.json()) as CanonicalEvidenceManifest;
          return manifest;
        }
      } catch {
        // Try fallback gateway
      }
    }

    return null;
  }
}

export const ipfsService = new IpfsService();
