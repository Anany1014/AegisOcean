// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AegisOceanEnforcement
 * @dev Smart contract for logging maritime oil spill incidents, IPFS evidence hashes, and enforcement actions.
 */
contract AegisOceanEnforcement is Ownable {
    
    enum EnforcementStatus {
        Reported,
        UnderInvestigation,
        ClearanceRevoked,
        Fined,
        Resolved
    }

    struct Incident {
        uint256 incidentId;
        uint256 timestamp;
        uint256 suspectMMSI;
        uint256 spillAreaSqM;
        uint256 attributionScoreBP; // Basis points (e.g. 8500 = 85.00%)
        string ipfsCID;
        bytes32 evidenceHash;
        uint256 calculatedFineUSD;
        EnforcementStatus status;
    }

    uint256 public incidentCount;
    mapping(uint256 => Incident) public incidents;

    event IncidentRecorded(
        uint256 indexed incidentId,
        uint256 indexed suspectMMSI,
        uint256 spillAreaSqM,
        uint256 attributionScoreBP,
        string ipfsCID
    );

    event PortClearanceRevoked(
        uint256 indexed incidentId,
        uint256 indexed suspectMMSI,
        uint256 calculatedFineUSD
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @dev View total incident count
     */
    function getIncidentCount() external view returns (uint256) {
        return incidentCount;
    }
}
