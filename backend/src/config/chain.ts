import { config } from './env.js';

export const CHAIN_CONFIG = {
  chainId: config.CHAIN_ID,
  rpcUrl: config.RPC_URL,
  contractAddress: config.CONTRACT_ADDRESS,
  explorerUrl: config.BLOCK_EXPLORER_URL,
  networkName: config.CHAIN_ID === 80002 ? 'Polygon Amoy Testnet' : 'Sepolia Testnet',
  isTestnet: true
};

export const MARITIME_FINE_LEDGER_ABI = [
  "function createIncident(bytes32 incidentId, uint64 suspectMMSI, string calldata ipfsCID, bytes32 evidenceHash, uint256 spillAreaSqKm, uint256 attributionScore) external returns (bytes32)",
  "function calculateFine(uint256 spillAreaSqKm) external view returns (uint256)",
  "function enforceFine(bytes32 incidentId) external",
  "function recordFineSettlement(bytes32 incidentId) external",
  "function releasePortClearance(bytes32 incidentId) external",
  "function getIncident(bytes32 incidentId) external view returns (tuple(bytes32 incidentId, uint64 suspectMMSI, string ipfsCID, bytes32 evidenceHash, uint256 spillAreaSqKm, uint256 attributionScore, uint256 fineAmount, uint8 status, uint64 createdAt, uint64 enforcedAt))",
  "function getFineParameters() external view returns (uint256 baseFine, uint256 areaMultiplier)",
  "function setFineParameters(uint256 baseFine, uint256 areaMultiplier) external",
  "event IncidentAnchored(bytes32 indexed incidentId, uint64 suspectMMSI, string ipfsCID, bytes32 evidenceHash)",
  "event FineEnforced(bytes32 indexed incidentId, uint256 fineAmount)",
  "event PortClearanceRevoked(bytes32 indexed incidentId, uint64 suspectMMSI)",
  "event FineSettled(bytes32 indexed incidentId, uint256 amount)",
  "event PortClearanceReleased(bytes32 indexed incidentId, uint64 suspectMMSI)"
];
