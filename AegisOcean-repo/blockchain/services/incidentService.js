const { ethers } = require("ethers");
const IPFSService = require("./ipfsService");
require("dotenv").config();

// Contract ABI for MaritimeFineLedger
const MARITIME_FINE_LEDGER_ABI = [
  "function createIncident(uint256 suspectMMSI, string memory ipfsCID, bytes32 evidenceHash, uint256 spillAreaSqKm, uint256 attributionScore) external returns (uint256)",
  "function getIncident(uint256 incidentId) external view returns (tuple(uint256 incidentId, uint256 suspectMMSI, string ipfsCID, bytes32 evidenceHash, uint256 spillAreaSqKm, uint256 attributionScore, uint256 fineAmount, uint8 status, uint256 createdAt))",
  "function incidentCount() external view returns (uint256)",
  "function baseFine() external view returns (uint256)",
  "function areaMultiplier() external view returns (uint256)",
  "function calculateFine(uint256 spillAreaSqKm) external view returns (uint256)",
  "event IncidentAnchored(uint256 indexed incidentId, uint256 indexed suspectMMSI, string ipfsCID, bytes32 evidenceHash, uint256 spillAreaSqKm, uint256 attributionScore, uint256 fineAmount)"
];

/**
 * @class IncidentService
 * @notice Backend service orchestrating the pipeline from forensic data receipt -> IPFS upload -> Blockchain anchoring.
 * @dev The private key is held securely on the server side and never exposed to the frontend.
 */
class IncidentService {
  /**
   * @param {string} contractAddress Deployed MaritimeFineLedger contract address
   * @param {ethers.Contract|ethers.Signer} signerOrContract Contract instance or Ethers signer
   * @param {IPFSService} [ipfsService] IPFS Service instance
   */
  constructor(contractAddress, signerOrContract, ipfsService) {
    this.ipfsService = ipfsService || new IPFSService();

    if (signerOrContract && contractAddress) {
      if (signerOrContract.interface) {
        // Already a Contract instance
        this.contract = signerOrContract;
      } else {
        // Ethers Signer passed
        this.contract = new ethers.Contract(contractAddress, MARITIME_FINE_LEDGER_ABI, signerOrContract);
      }
    }
  }

  /**
   * Validates forensic incident input parameters before processing.
   * @param {Object} data
   */
  validateIncidentInput({ suspectMMSI, spillAreaSqKm, attributionScore }) {
    if (!suspectMMSI || typeof suspectMMSI !== 'number' || suspectMMSI <= 0) {
      throw new Error("Invalid data: suspectMMSI must be a valid positive 9-digit MMSI number");
    }
    if (typeof spillAreaSqKm !== 'number' || spillAreaSqKm < 0) {
      throw new Error("Invalid data: spillAreaSqKm must be a non-negative number");
    }
    if (typeof attributionScore !== 'number' || attributionScore < 0 || attributionScore > 100) {
      throw new Error("Invalid data: attributionScore must be a percentage between 0 and 100");
    }
  }

  /**
   * Main Pipeline: Forensic Result -> IPFS Upload -> Evidence Hash -> Smart Contract Transaction
   * @param {Object} forensicData
   * @param {number} forensicData.suspectMMSI
   * @param {number} forensicData.spillAreaSqKm
   * @param {number} forensicData.attributionScore
   * @param {Object} [forensicData.satelliteImage]
   * @param {Object} [forensicData.spillGeoJSON]
   * @param {Object} [forensicData.driftData]
   * @param {Object} [forensicData.aisData]
   * @param {Object} [forensicData.pasReport]
   * @returns {Promise<Object>} Execution summary including incidentId, ipfsCID, evidenceHash, and transactionHash.
   */
  async processAndAnchorIncident(forensicData) {
    // Step 1: Input Validation
    this.validateIncidentInput(forensicData);

    // Step 2: Build Evidence Bundle
    let evidenceBundle;
    try {
      evidenceBundle = this.ipfsService.createEvidenceBundle(forensicData);
    } catch (err) {
      throw new Error(`Evidence bundling failed: ${err.message}`);
    }

    // Step 3: Upload Evidence Bundle to IPFS
    let ipfsResult;
    try {
      ipfsResult = await this.ipfsService.uploadEvidenceBundle(evidenceBundle);
    } catch (err) {
      throw new Error(`IPFS upload failure: ${err.message}`);
    }

    const { ipfsCID, evidenceHash } = ipfsResult;

    if (!ipfsCID || !evidenceHash) {
      throw new Error("IPFS upload failure: Received invalid CID or evidence hash");
    }

    // Step 4: Submit Blockchain Transaction
    if (!this.contract) {
      throw new Error("Blockchain service error: Contract instance not initialized");
    }

    try {
      const tx = await this.contract.createIncident(
        forensicData.suspectMMSI,
        ipfsCID,
        evidenceHash,
        forensicData.spillAreaSqKm,
        forensicData.attributionScore
      );

      const receipt = await tx.wait();

      // Extract IncidentId and Fine from emitted event logs
      let incidentId = null;
      let fineAmount = null;

      if (receipt && receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const parsedLog = this.contract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === "IncidentAnchored") {
              incidentId = parsedLog.args.incidentId.toString();
              fineAmount = parsedLog.args.fineAmount.toString();
              break;
            }
          } catch (e) {
            // Ignore unparsed logs
          }
        }
      }

      return {
        success: true,
        incidentId: incidentId ? parseInt(incidentId, 10) : null,
        suspectMMSI: forensicData.suspectMMSI,
        spillAreaSqKm: forensicData.spillAreaSqKm,
        attributionScore: forensicData.attributionScore,
        fineAmountUSD: fineAmount ? parseInt(fineAmount, 10) : null,
        ipfsCID: ipfsCID,
        evidenceHash: evidenceHash,
        transactionHash: receipt.hash || tx.hash,
        blockNumber: receipt.blockNumber,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      // Comprehensive Error Classification
      if (err.code === "INSUFFICIENT_FUNDS") {
        throw new Error("Blockchain transaction failure: Insufficient gas/funds in server wallet");
      } else if (err.message && err.message.includes("AccessControlUnauthorizedAccount")) {
        throw new Error("Blockchain transaction failure: Server wallet lacks EVIDENCE_ATTESTOR_ROLE");
      } else if (err.message && err.message.includes("IPFS CID cannot be empty")) {
        throw new Error("Blockchain transaction failure: Empty IPFS CID rejected by contract");
      } else {
        throw new Error(`Blockchain transaction failure: ${err.reason || err.message}`);
      }
    }
  }
}

module.exports = IncidentService;
