import { createHash } from 'node:crypto';
import { keccak256, toUtf8Bytes, encodeBytes32String, id } from 'ethers';

/**
 * Deterministically sorts object keys recursively for canonical JSON hashing
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(',')}]`;
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return `"${key}":${canonicalizeJson(value)}`;
  });

  return `{${pairs.join(',')}}`;
}

/**
 * Calculates SHA-256 hash of a string or buffer
 */
export function computeSha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Calculates Keccak-256 hash formatted as bytes32 hex string (0x...)
 */
export function computeKeccak256(data: string): string {
  return keccak256(toUtf8Bytes(data));
}

/**
 * Converts an incident ID string (<= 31 bytes) to bytes32, or hashes if longer
 */
export function formatIncidentIdToBytes32(incidentId: string): string {
  try {
    if (toUtf8Bytes(incidentId).length <= 31) {
      return encodeBytes32String(incidentId);
    }
  } catch {
    // Fall back to id/keccak256 if byte length > 31
  }
  return id(incidentId);
}
