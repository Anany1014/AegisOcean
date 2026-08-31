import { describe, it, expect } from 'vitest';
import {
  canonicalizeJson,
  computeSha256,
  computeKeccak256,
  formatIncidentIdToBytes32
} from '../src/utils/crypto.js';

describe('Crypto Utilities', () => {
  it('should deterministically canonicalize JSON regardless of key order', () => {
    const objA = { z: 1, a: 2, m: { y: 'test', x: 10 } };
    const objB = { a: 2, m: { x: 10, y: 'test' }, z: 1 };

    const canonA = canonicalizeJson(objA);
    const canonB = canonicalizeJson(objB);

    expect(canonA).toEqual(canonB);
    expect(canonA).toBe('{"a":2,"m":{"x":10,"y":"test"},"z":1}');
  });

  it('should compute consistent SHA-256 hashes', () => {
    const text = 'AegisOcean-Forensics';
    const hash = computeSha256(text);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should compute valid bytes32 Keccak-256 hashes', () => {
    const text = 'canonical-manifest-json';
    const keccak = computeKeccak256(text);
    expect(keccak.startsWith('0x')).toBe(true);
    expect(keccak.length).toBe(66);
  });

  it('should format incident IDs to bytes32 hex', () => {
    const incidentId = 'INC-20260831-001';
    const bytes32Hex = formatIncidentIdToBytes32(incidentId);
    expect(bytes32Hex.startsWith('0x')).toBe(true);
    expect(bytes32Hex.length).toBe(66);
  });
});
