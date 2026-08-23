import React, { useState, useEffect } from 'react';

/**
 * @component BlockchainEvidencePanel
 * @notice AegisOcean Dashboard Component for displaying on-chain incident data, IPFS CIDs, evidence hash verification, and triggering fine enforcement.
 * @security NO PRIVATE KEYS ARE STORED OR EXPOSED IN THIS FRONTEND COMPONENT. All actions invoke backend API endpoints.
 */
export default function BlockchainEvidencePanel({ incidentId = 1, apiBaseUrl = "http://localhost:4000" }) {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Verification State: null | "verifying" | "verified" | "mismatch"
  const [verifyState, setVerifyState] = useState(null);
  const [verifyMessage, setVerifyMessage] = useState("");

  // Enforcement State: "idle" | "Pending" | "Confirmed" | "Failed"
  const [enforceState, setEnforceState] = useState("idle");
  const [enforceTxHash, setEnforceTxHash] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch incident details from backend
  const fetchIncidentData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBaseUrl}/api/blockchain/incident/${incidentId}`);
      const data = await res.json();
      if (data.success) {
        setIncident(data);
      }
    } catch (err) {
      console.error("Failed to load blockchain incident data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentData();
  }, [incidentId]);

  // Handler 1: Verify Evidence (IPFS retrieval -> Hash compute -> Compare with on-chain evidenceHash)
  const handleVerifyEvidence = async () => {
    try {
      setVerifyState("verifying");
      const res = await fetch(`${apiBaseUrl}/api/blockchain/verify-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipfsCID: incident?.ipfsCID,
          storedEvidenceHash: incident?.evidenceHash
        })
      });
      const data = await res.json();
      if (data.success && data.verified) {
        setVerifyState("verified");
        setVerifyMessage("Evidence Verified");
      } else {
        setVerifyState("mismatch");
        setVerifyMessage("Evidence Mismatch");
      }
    } catch (err) {
      setVerifyState("mismatch");
      setVerifyMessage("Evidence Verification Failed");
    }
  };

  // Handler 2: Enforce Fine on Blockchain (Server signs tx using private key)
  const handleEnforceFine = async () => {
    try {
      setEnforceState("Pending");
      setErrorMessage("");

      const res = await fetch(`${apiBaseUrl}/api/blockchain/enforce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId: incidentId })
      });

      const data = await res.json();

      if (data.success && data.status === "Confirmed") {
        setEnforceState("Confirmed");
        setEnforceTxHash(data.transactionHash);
        fetchIncidentData(); // Refresh on-chain status
      } else {
        setEnforceState("Failed");
        setErrorMessage(data.error || "Enforcement transaction failed");
      }
    } catch (err) {
      setEnforceState("Failed");
      setErrorMessage(err.message || "Network error during enforcement call");
    }
  };

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={styles.spinner}>Loading Blockchain Ledger Record...</div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={styles.icon}>⛓️</span>
          <h3 style={styles.title}>Blockchain & IPFS Forensic Ledger</h3>
        </div>
        <span style={styles.badgeSuccess}>
          ● {incident?.blockchainStatus || "Anchored On-Chain"}
        </span>
      </div>

      {/* Grid of 10 Fields */}
      <div style={styles.grid}>
        <div style={styles.fieldItem}>
          <span style={styles.label}>Incident ID:</span>
          <span style={styles.valHighlight}>#{incident?.incidentId}</span>
        </div>

        <div style={styles.fieldItem}>
          <span style={styles.label}>Suspect MMSI:</span>
          <span style={styles.val}>{incident?.suspectMMSI}</span>
        </div>

        <div style={styles.fieldItem}>
          <span style={styles.label}>Attribution Score:</span>
          <span style={styles.valScore}>{incident?.attributionScore}% Confidence</span>
        </div>

        <div style={styles.fieldItem}>
          <span style={styles.label}>Spill Area:</span>
          <span style={styles.val}>{incident?.spillAreaSqKm} sq km</span>
        </div>

        <div style={styles.fieldItem}>
          <span style={styles.label}>Demonstration Fine:</span>
          <span style={styles.valFine}>${incident?.fineAmountUSD?.toLocaleString()} USD</span>
        </div>

        <div style={styles.fieldItem}>
          <span style={styles.label}>Enforcement Status:</span>
          <span style={incident?.enforcementStatus === 'Enforced' ? styles.badgeDanger : styles.badgeInfo}>
            {incident?.enforcementStatus}
          </span>
        </div>
      </div>

      {/* Technical Crypto Details */}
      <div style={styles.cryptoBox}>
        <div style={styles.hashRow}>
          <span style={styles.label}>IPFS CID:</span>
          <a
            href={`https://ipfs.io/ipfs/${incident?.ipfsCID}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            {incident?.ipfsCID} ↗
          </a>
        </div>

        <div style={styles.hashRow}>
          <span style={styles.label}>Evidence Hash (SHA-256):</span>
          <code style={styles.code}>{incident?.evidenceHash}</code>
        </div>

        <div style={styles.hashRow}>
          <span style={styles.label}>Blockchain Tx Hash:</span>
          <code style={styles.code}>{incident?.transactionHash}</code>
        </div>
      </div>

      {/* Verification Output Status Banner */}
      {verifyState === "verifying" && (
        <div style={styles.bannerInfo}>Retrieving IPFS dossier & recalculating SHA-256 hash...</div>
      )}
      {verifyState === "verified" && (
        <div style={styles.bannerSuccess}>✓ {verifyMessage}: On-chain hash matches IPFS payload byte-for-byte.</div>
      )}
      {verifyState === "mismatch" && (
        <div style={styles.bannerDanger}>⚠️ {verifyMessage}: Evidence payload does not match on-chain hash!</div>
      )}

      {/* Enforcement Transaction State Banner */}
      {enforceState === "Pending" && (
        <div style={styles.bannerWarning}>⏳ Transaction Pending: Submitting enforcement tx to Polygon Amoy...</div>
      )}
      {enforceState === "Confirmed" && (
        <div style={styles.bannerSuccess}>
          ✓ Enforcement Confirmed! Port clearance revoked. Tx: <code style={styles.code}>{enforceTxHash}</code>
        </div>
      )}
      {enforceState === "Failed" && (
        <div style={styles.bannerDanger}>❌ Transaction Failed: {errorMessage}</div>
      )}

      {/* Action Buttons */}
      <div style={styles.actionRow}>
        <button
          onClick={handleVerifyEvidence}
          style={styles.btnSecondary}
          disabled={verifyState === "verifying"}
        >
          🔍 [Verify Evidence]
        </button>

        <button
          onClick={handleEnforceFine}
          style={styles.btnPrimary}
          disabled={enforceState === "Pending" || incident?.enforcementStatus === "Enforced"}
        >
          ⚖️ [Enforce Fine on Blockchain]
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #1e293b',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    fontFamily: 'Inter, system-ui, sans-serif',
    marginTop: '20px'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
    paddingBottom: '14px',
    marginBottom: '18px'
  },
  title: { margin: 0, fontSize: '18px', fontWeight: '600', color: '#38bdf8' },
  icon: { fontSize: '20px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  fieldItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  val: { fontSize: '15px', fontWeight: '500', color: '#e2e8f0' },
  valHighlight: { fontSize: '16px', fontWeight: '700', color: '#38bdf8' },
  valScore: { fontSize: '15px', fontWeight: '600', color: '#4ade80' },
  valFine: { fontSize: '16px', fontWeight: '700', color: '#facc15' },
  badgeSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  badgeInfo: { backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', display: 'inline-block' },
  badgeDanger: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', display: 'inline-block' },
  cryptoBox: { backgroundColor: '#020617', borderRadius: '8px', padding: '14px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' },
  hashRow: { display: 'flex', flexDirection: 'column', gap: '2px' },
  link: { color: '#38bdf8', textDecoration: 'none', wordBreak: 'break-all', fontSize: '13px' },
  code: { backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: '4px', color: '#a7f3d0', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' },
  bannerInfo: { backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid #0284c7', color: '#38bdf8', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' },
  bannerSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #16a34a', color: '#4ade80', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' },
  bannerWarning: { backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid #ca8a04', color: '#facc15', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' },
  bannerDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #dc2626', color: '#f87171', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' },
  actionRow: { display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' },
  btnSecondary: { backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  btnPrimary: { backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  spinner: { color: '#94a3b8', textAlign: 'center', padding: '20px' }
};
