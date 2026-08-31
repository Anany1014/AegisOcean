export enum ContractIncidentStatus {
  Anchored = 0,
  Enforced = 1,
  Settled = 2,
  Released = 3
}

export interface ContractIncidentView {
  incidentId: string;
  suspectMMSI: bigint;
  ipfsCID: string;
  evidenceHash: string;
  spillAreaSqKm: bigint;
  attributionScore: bigint;
  fineAmount: bigint;
  status: ContractIncidentStatus;
  createdAt: bigint;
  enforcedAt: bigint;
}

export interface AnchorResult {
  incidentId: string;
  incidentIdBytes32: string;
  suspectMMSI?: number;
  ipfsCID: string;
  evidenceHash: string;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
  confirmations?: number;
  explorerUrl: string;
  status: string;
  isMock?: boolean;
  events?: {
    incidentAnchored?: {
      incidentId: string;
      suspectMMSI: string;
      ipfsCID: string;
      evidenceHash: string;
    };
  };
}

export interface BlockchainEnforceResult {
  incidentId: string;
  incidentIdBytes32: string;
  txHash: string;
  blockNumber?: number;
  fineAmount?: number;
  clearanceRevoked: boolean;
  explorerUrl: string;
  status: string;
}

export interface BlockchainSettlementResult {
  incidentId: string;
  incidentIdBytes32: string;
  txHash: string;
  blockNumber?: number;
  explorerUrl: string;
  status: string;
}

export interface BlockchainClearanceResult {
  incidentId: string;
  incidentIdBytes32: string;
  txHash: string;
  blockNumber?: number;
  explorerUrl: string;
  status: string;
}

export interface VerificationResult {
  incidentId: string;
  ipfsCID: string;
  calculatedEvidenceHash: string;
  onChainEvidenceHash: string;
  result: 'MATCH' | 'MISMATCH';
  verified: boolean;
  calculatedHash?: string;
  onChainHash?: string;
  details?: string;
  timestamp: string;
}

export interface BlockchainNetworkStatus {
  networkName: string;
  chainId: number;
  contractAddress: string;
  rpcConnected: boolean;
  explorerUrl: string;
  attestorAddress: string;
  enforcementAddress: string;
}
