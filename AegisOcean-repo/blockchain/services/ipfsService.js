const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

/**
 * @class IPFSService
 * @notice Service for creating forensic evidence bundles, computing SHA-256 hashes,
 * and uploading evidence dossiers to IPFS via Pinata API.
 */
class IPFSService {
  /**
   * @param {string} [apiKey] Optional Pinata API Key (defaults to process.env.PINATA_API_KEY)
   * @param {string} [apiSecret] Optional Pinata API Secret (defaults to process.env.PINATA_API_SECRET)
   * @param {string} [jwt] Optional Pinata JWT Token (defaults to process.env.PINATA_JWT)
   */
  constructor(apiKey, apiSecret, jwt) {
    this.apiKey = apiKey || process.env.PINATA_API_KEY;
    this.apiSecret = apiSecret || process.env.PINATA_API_SECRET;
    this.jwt = jwt || process.env.PINATA_JWT;
  }

  /**
   * Generates a deterministic SHA-256 hash of the evidence bundle formatted for Solidity bytes32.
   * @param {Object} bundle The evidence bundle payload object
   * @returns {string} SHA-256 hash string starting with "0x"
   */
  generateEvidenceHash(bundle) {
    const jsonString = typeof bundle === 'string' ? bundle : JSON.stringify(bundle);
    const hashHex = crypto.createHash('sha256').update(jsonString).digest('hex');
    return '0x' + hashHex;
  }

  /**
   * Bundles forensic evidence files and metadata.
   * @param {Object} params
   * @param {number} params.suspectMMSI 9-digit MMSI ship identifier
   * @param {string|Object} [params.satelliteImage] Satellite image metadata or base64
   * @param {Object} [params.spillGeoJSON] Oil spill polygon GeoJSON data
   * @param {Object} [params.driftData] Hydrodynamic drift prediction data
   * @param {Object} [params.aisData] AIS tracking trajectory points
   * @param {Object} [params.pasReport] Pollution Attribution System AI report
   * @returns {Object} Complete evidence bundle object
   */
  createEvidenceBundle({ suspectMMSI, satelliteImage, spillGeoJSON, driftData, aisData, pasReport }) {
    if (!suspectMMSI) {
      throw new Error("suspectMMSI is required to create an evidence bundle");
    }

    return {
      title: "AegisOcean Marine Oil Spill Forensic Evidence Dossier",
      version: "1.0",
      createdAt: new Date().toISOString(),
      suspectMMSI: suspectMMSI,
      evidenceFiles: {
        satelliteImage: satelliteImage || "N/A",
        spillGeoJSON: spillGeoJSON || {},
        driftData: driftData || {},
        aisData: aisData || {},
        pasReport: pasReport || {}
      }
    };
  }

  /**
   * Uploads the evidence bundle to Pinata IPFS.
   * If live credentials are missing, falls back to deterministic Mock IPFS CID generation for testing.
   * @param {Object} bundle Evidence bundle object created by createEvidenceBundle
   * @returns {Promise<{ipfsCID: string, evidenceHash: string, timestamp: string, pinnedToIPFS: boolean}>}
   */
  async uploadEvidenceBundle(bundle) {
    const evidenceHash = this.generateEvidenceHash(bundle);
    const timestamp = new Date().toISOString();

    // Live Pinata API Upload if credentials present
    if (this.jwt || (this.apiKey && this.apiSecret && this.apiKey !== 'your_pinata_api_key_here')) {
      try {
        const headers = this.jwt && this.jwt !== 'your_pinata_jwt_token_here'
          ? { Authorization: `Bearer ${this.jwt}` }
          : { pinata_api_key: this.apiKey, pinata_secret_api_key: this.apiSecret };

        const response = await axios.post(
          'https://api.pinata.cloud/pinning/pinJSONToIPFS',
          {
            pinataContent: bundle,
            pinataMetadata: {
              name: `AegisOcean_MMSI_${bundle.suspectMMSI}_${Date.now()}`
            }
          },
          { headers, timeout: 10000 }
        );

        return {
          ipfsCID: response.data.IpfsHash,
          evidenceHash: evidenceHash,
          timestamp: timestamp,
          pinnedToIPFS: true
        };
      } catch (error) {
        throw new Error(`Pinata IPFS Upload Error: ${error.response?.data?.error || error.message}`);
      }
    } else {
      // Mock mode for local testing without live API keys
      const mockCidSuffix = crypto.createHash('sha256').update(JSON.stringify(bundle)).digest('hex').substring(0, 32);
      const mockIpfsCID = `Qm${mockCidSuffix}AegisOceanMockCID`;

      return {
        ipfsCID: mockIpfsCID,
        evidenceHash: evidenceHash,
        timestamp: timestamp,
        pinnedToIPFS: false,
        warning: "Mock IPFS CID generated. Set valid PINATA_JWT or PINATA_API_KEY in .env for live IPFS pinning."
      };
    }
  }
}

module.exports = IPFSService;
