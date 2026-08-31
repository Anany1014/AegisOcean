# AegisOcean Backend & Web3 Security Audit

**Auditor:** Senior Backend & Web3 Security Engineer  
**Scope:** AegisOcean SIH MVP Backend, Decentralized Storage (IPFS/Pinata), Smart Contract Integration (`MaritimeFineLedger`), and REST APIs  
**Date:** August 31, 2026  
**Status:** Audit Complete — Pending Approval  

---

## Executive Summary

The AegisOcean backend demonstrates a robust architectural separation of concerns:
- Large forensic rasters/telemetry files are kept off-chain on IPFS.
- Only deterministic canonical manifest hashes (`evidenceHash`) and compact metadata are anchored on-chain.
- Privileged operations (`enforceFine`, `recordFineSettlement`, `releasePortClearance`) are enforced via server-side role authentication and explicit state machine transitions.
- Private keys and sensitive credentials are isolated on the server and never exposed in API responses or public routes.

This security review identifies potential vulnerabilities, operational risks, and hardening opportunities across **Authentication**, **Web3 Transaction Management**, **Input/Resource Limits**, and **Resilience**.

---

## Findings Summary

| Severity | Count | Summary of Key Issues |
| :--- | :---: | :--- |
| **CRITICAL** | 0 | No remote code execution or private key exposure vulnerabilities found. |
| **HIGH** | 2 | Missing authentication on `/anchor` ingress (Gas Exhaustion / DoS risk); Fallback default credentials in production config. |
| **MEDIUM** | 4 | Concurrency & Nonce collisions on server signers; Missing API rate limiting; Timing attack susceptibility in API key comparisons; In-memory store persistence boundary. |
| **LOW** | 4 | Missing maximum file size constraints in validation schema; Unchecked IPFS CID string format before gateway interpolation; Default gas estimation without slippage buffer; Stack trace exposure in non-production modes. |

---

## Detailed Audit Findings

### 1. High Severity Findings

#### SEC-HIGH-01: Missing Authentication on Incident Ingress (`POST /api/incidents/anchor`)
- **Affected File:** [`src/routes/incident.routes.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/routes/incident.routes.ts#L10-L14)
- **Problem:** `POST /api/incidents/anchor` is currently exposed without `authenticate` and `requireRole(UserRole.EVIDENCE_ATTESTOR)` middleware.
- **Why It Matters:** Any unauthenticated caller on the public network can submit arbitrary incident payloads. Each invocation triggers:
  1. Pinata IPFS upload consumption.
  2. Server-side blockchain transaction signing (`createIncident()`) consuming deployer testnet gas (`POL`/`ETH`).
  3. Filling the on-chain ledger with spam incidents, causing financial and compute resource exhaustion (Denial of Service).
- **Recommended Fix:** Apply `authenticate` and `requireRole(UserRole.EVIDENCE_ATTESTOR, UserRole.ADMIN)` middleware to `POST /api/incidents/anchor`.

---

#### SEC-HIGH-02: Hardcoded Insecure Default Fallbacks in Configuration
- **Affected File:** [`src/config/env.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/config/env.ts#L16-L23)
- **Problem:** `envSchema` provides hardcoded fallback values for `ATTESTOR_PRIVATE_KEY` (`0x0...01`), `ENFORCEMENT_PRIVATE_KEY` (`0x0...02`), and role API keys (`aegis-enforcement-auth-key-2026`).
- **Why It Matters:** If the backend is deployed to staging or production without a properly populated `.env` file, it will silently boot using well-known, publicly known private keys and API tokens. Anyone knowing the default keys could impersonate the enforcement authority.
- **Recommended Fix:** In `production` environment (`NODE_ENV === 'production'`), enforce that private keys and API secrets are strictly required non-empty strings with no default values via Zod refinement.

---

### 2. Medium Severity Findings

#### SEC-MED-01: Potential Nonce Collision & Transaction Replacement Under Concurrency
- **Affected File:** [`src/services/blockchain.service.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/services/blockchain.service.ts#L93-L130)
- **Problem:** `createIncident`, `enforceFine`, `recordFineSettlement`, and `releasePortClearance` invoke `contract.method()` directly using `ethers.Wallet`.
- **Why It Matters:** If multiple incidents arrive concurrently or multiple enforcement calls occur simultaneously, `ethers.js` will request the transaction count (nonce) for the signer in parallel. Both transactions may receive the same nonce, causing one transaction to fail with `replacement transaction underpriced` or `nonce too low`.
- **Recommended Fix:** Implement a mutex lock or sequential in-memory transaction queue per signer wallet to serialize transaction dispatch and manage nonces deterministically.

---

#### SEC-MED-02: Absence of Rate Limiting Middleware
- **Affected File:** [`src/app.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/app.ts)
- **Problem:** The Express application does not implement rate limiting on public routes (`GET /api/incidents/:id/verify-evidence`, `GET /api/incidents/:id`).
- **Why It Matters:** An attacker could flood the `/verify-evidence` endpoint, forcing the server to perform repeated CPU-intensive canonical JSON serializations, SHA-256/Keccak-256 hash calculations, and external IPFS gateway fetches, resulting in API starvation.
- **Recommended Fix:** Add `express-rate-limit` with tiered limits (e.g. 100 req/min for public read/verify routes, 30 req/min for write/anchor routes).

---

#### SEC-MED-03: String Comparison Susceptible to Timing Attacks in Authentication
- **Affected File:** [`src/middleware/auth.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/middleware/auth.ts#L38-L50)
- **Problem:** API keys are compared using standard JavaScript string equality (`token === config.ENFORCEMENT_API_KEY`).
- **Why It Matters:** Standard equality operators terminate early upon the first mismatched character. Over many measurements over a low-latency connection, an attacker can theoretically infer characters of the secret API key through side-channel timing analysis.
- **Recommended Fix:** Use `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedKey))` with constant-time length padding.

---

#### SEC-MED-04: Volatile In-Memory Storage Boundary
- **Affected File:** [`src/services/incident.service.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/services/incident.service.ts#L51)
- **Problem:** Incident metadata is stored in an in-memory `Map<string, IncidentRecord>`.
- **Why It Matters:** While on-chain events re-hydrate state on startup, local forensic manifest metadata (such as individual evidence file names, sizes, and raw JSON representations) is lost if the server process restarts unexpectedly between IPFS pinning and DB persistence.
- **Recommended Fix:** Connect the Prisma SQLite/PostgreSQL database schema defined in the architecture plan to persist incident records to disk permanently.

---

### 3. Low Severity Findings

#### SEC-LOW-01: Missing Maximum Individual File Size Constraint in Validation Schema
- **Affected File:** [`src/services/validation.service.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/services/validation.service.ts#L33-L39)
- **Problem:** `evidenceFilePayloadSchema` validates that file name and base64 strings are present, but does not impose a maximum byte length per file.
- **Why It Matters:** While `app.ts` sets an overall body limit of `25mb`, an individual file within the JSON array can allocate large string buffers during base64 decoding.
- **Recommended Fix:** Add a `.max(10 * 1024 * 1024)` character length check on `contentBase64` in Zod schema.

---

#### SEC-LOW-02: IPFS CID Format Unvalidated Before Gateway URL Construction
- **Affected File:** [`src/services/ipfs.service.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/services/ipfs.service.ts#L125-L135)
- **Problem:** `fetchEvidenceManifest(ipfsCID)` directly interpolates `ipfsCID` into HTTP URLs without regex checking for valid IPFS CIDv0 (`Qm...`) or CIDv1 (`bafy...`) formats.
- **Why It Matters:** A malformed or crafted CID string containing path traversal characters could trigger malformed requests against IPFS gateways.
- **Recommended Fix:** Validate `ipfsCID` format with `/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{55})$/` before gateway requests.

---

#### SEC-LOW-03: Blockchain Gas Price & Slippage Resilience
- **Affected File:** [`src/services/blockchain.service.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/services/blockchain.service.ts#L93-L120)
- **Problem:** Contract write calls do not specify explicit EIP-1559 `maxFeePerGas` or `maxPriorityFeePerGas` parameters, relying on default provider estimates.
- **Why It Matters:** During testnet gas spikes on Polygon Amoy or Sepolia, transactions with default fees can remain pending in the mempool for extended periods without confirming.
- **Recommended Fix:** Implement dynamic gas estimation with a 15% priority fee buffer for testnet transaction reliability.

---

#### SEC-LOW-04: Error Stack Trace Exposure in Development Mode
- **Affected File:** [`src/middleware/errorHandler.ts`](file:///c:/Users/Ojaswini/aegisocean/backend/src/middleware/errorHandler.ts#L52)
- **Problem:** `errorHandler` includes `err.stack` in JSON responses when `NODE_ENV === 'development'`.
- **Why It Matters:** If developers inadvertently expose development instances to public testnet environments, internal filesystem paths and module structures are visible to external callers.
- **Recommended Fix:** Restrict stack trace return in responses strictly to `NODE_ENV === 'test'` or local debug headers.

---

## Verification & Architecture Strengths

The AegisOcean implementation adheres to top-tier Web3 and decentralized storage security practices:
- ✅ **Private Key Hygiene:** Private keys are isolated in backend memory; no endpoint returns or accepts private keys from the client.
- ✅ **Evidentiary Attribution vs Legal Enforcement:** The AI model is strictly evidentiary; fine enforcement requires authorized authority attestation.
- ✅ **Canonical JSON Determinism:** Manifest key ordering is recursive and deterministic; identical inputs always produce the exact same `evidenceHash`.
- ✅ **IPFS Failure Isolation:** If IPFS upload fails, blockchain transactions are aborted immediately to prevent orphaned on-chain records.
- ✅ **Idempotent Event Synchronization:** Composite event keys prevent replay attacks and duplicate state mutations.

---
*This security review document has been created for team review. Please approve the recommended mitigations before code modifications are applied.*
