import {
  ForensicAnchorPayload,
  CanonicalEvidenceManifest,
  ManifestFileEntry,
  EvidenceFilePayload
} from '../types/incident.types.js';
import {
  canonicalizeJson,
  computeSha256,
  computeKeccak256
} from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

export class EvidenceManifestService {
  private log = logger.forContext('EvidenceManifestService');

  /**
   * Computes SHA-256 hash for an individual evidence file
   */
  public hashEvidenceFile(file: EvidenceFilePayload): string {
    if (file.sha256 && /^[a-fA-F0-9]{64}$/.test(file.sha256)) {
      return file.sha256.toLowerCase();
    }
    if (file.contentBase64) {
      const buffer = Buffer.from(file.contentBase64, 'base64');
      return computeSha256(buffer);
    }
    // Fallback: hash the file reference name + size
    return computeSha256(`file:${file.name}:${file.sizeBytes || 0}`);
  }

  /**
   * Generates a deterministic canonical evidence manifest from forensic incident data
   */
  public generateManifest(payload: ForensicAnchorPayload): CanonicalEvidenceManifest {
    this.log.debug(`Generating deterministic manifest for incident: ${payload.incidentId}`);

    // Compute SHA-256 for each evidence file
    const fileEntries: ManifestFileEntry[] = payload.files.map((file) => {
      const sha256 = this.hashEvidenceFile(file);
      let sizeBytes = file.sizeBytes;
      if (!sizeBytes && file.contentBase64) {
        sizeBytes = Buffer.from(file.contentBase64, 'base64').byteLength;
      }
      return {
        name: file.name,
        sha256,
        sizeBytes: sizeBytes || 0
      };
    });

    // Deterministically sort files by name
    fileEntries.sort((a, b) => a.name.localeCompare(b.name));

    const aisRange =
      payload.AISDataRange ||
      payload.aisDataRange ||
      `${payload.originTimeWindow.start}-${payload.originTimeWindow.end}`;

    const manifest: CanonicalEvidenceManifest = {
      incidentId: payload.incidentId,
      sourceSatellite: payload.sourceSatellite,
      sceneId: payload.sceneId,
      detectionTimestamp: payload.detectionTimestamp,
      spillAreaSqKm: payload.spillAreaSqKm,
      originTimeWindow: {
        start: payload.originTimeWindow.start,
        end: payload.originTimeWindow.end
      },
      originCoordinates: {
        latitude: payload.originCoordinates.latitude,
        longitude: payload.originCoordinates.longitude
      },
      driftModelVersion: payload.driftModelVersion,
      aisDataRange: aisRange,
      suspectMMSI: payload.suspectMMSI,
      attributionScore: payload.attributionScore,
      softwareVersions: {
        hydrodynamicEngine: payload.softwareVersions?.hydrodynamicEngine || 'OpenDrift-v2.1',
        sarSegmentation: payload.softwareVersions?.sarSegmentation || 'AegisOcean-UNet-v1.4',
        aisEngine: payload.softwareVersions?.aisEngine || 'AegisCorrelator-v1.0'
      },
      files: fileEntries
    };

    return manifest;
  }

  /**
   * Computes the deterministic canonical JSON string, SHA-256, and Keccak-256 evidenceHash (bytes32 hex)
   */
  public computeManifestDigest(manifest: CanonicalEvidenceManifest): {
    canonicalJson: string;
    evidenceHash: string;
    sha256: string;
  } {
    const canonicalJson = canonicalizeJson(manifest);
    const evidenceHash = computeKeccak256(canonicalJson);
    const sha256 = computeSha256(canonicalJson);

    this.log.debug(`Calculated digest for incident ${manifest.incidentId}`, {
      evidenceHash,
      sha256
    });

    return {
      canonicalJson,
      evidenceHash,
      sha256
    };
  }
}

export const evidenceManifestService = new EvidenceManifestService();
