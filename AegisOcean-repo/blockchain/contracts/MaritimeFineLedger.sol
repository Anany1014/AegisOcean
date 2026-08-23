// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MaritimeFineLedger
 * @notice Smart contract for AegisOcean to store oil spill incident metadata, manage IPFS evidence CIDs,
 * compute demonstration fines, and handle maritime enforcement and port clearance statuses.
 * @dev Inherits OpenZeppelin AccessControl for role-based security.
 */
contract MaritimeFineLedger is AccessControl {

    // ==========================================
    // ROLES DEFINITIONS
    // ==========================================
    // Role permitted to anchor new evidence and record incidents
    bytes32 public constant EVIDENCE_ATTESTOR_ROLE = keccak256("EVIDENCE_ATTESTOR_ROLE");
    
    // Role permitted to enforce fines, record settlements, and update port clearance status
    bytes32 public constant ENFORCEMENT_AUTHORITY_ROLE = keccak256("ENFORCEMENT_AUTHORITY_ROLE");

    // ==========================================
    // STATUS ENUM
    // ==========================================
    enum Status {
        Anchored,   // Incident registered on-chain with IPFS evidence CID
        Enforced,   // Fine enforced, port clearance revoked
        Settled,    // Fine paid or settled by maritime authority
        Released    // Port clearance restored
    }

    // ==========================================
    // INCIDENT DATA STRUCTURE
    // ==========================================
    struct Incident {
        uint256 incidentId;          // Unique auto-incrementing incident identifier
        uint256 suspectMMSI;         // 9-digit Maritime Mobile Service Identity of suspect ship
        string ipfsCID;              // Content Identifier pointing to evidence on IPFS (GeoTIFF/AIS files)
        bytes32 evidenceHash;        // SHA-256 cryptographic hash of evidence files for verification
        uint256 spillAreaSqKm;       // Detected oil spill area in square kilometers
        uint256 attributionScore;    // AI attribution confidence score (0 to 100)
        uint256 fineAmount;          // Calculated demonstration fine in USD
        Status status;               // Current enforcement status (Anchored, Enforced, Settled, Released)
        uint256 createdAt;           // Block timestamp when incident was created
    }

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    uint256 public incidentCount;
    mapping(uint256 => Incident) public incidents;

    // Demonstration fine calculation settings (configurable by Admin)
    uint256 public baseFine;         // Base demonstration fine (e.g., $10,000)
    uint256 public areaMultiplier;   // Additional fine per square kilometer (e.g., $5,000)

    // ==========================================
    // EVENTS
    // ==========================================
    event IncidentAnchored(
        uint256 indexed incidentId,
        uint256 indexed suspectMMSI,
        string ipfsCID,
        bytes32 evidenceHash,
        uint256 spillAreaSqKm,
        uint256 attributionScore,
        uint256 fineAmount
    );

    event FineEnforced(
        uint256 indexed incidentId,
        uint256 indexed suspectMMSI,
        uint256 fineAmount
    );

    event PortClearanceRevoked(
        uint256 indexed incidentId,
        uint256 indexed suspectMMSI
    );

    event FineSettled(
        uint256 indexed incidentId,
        uint256 indexed suspectMMSI,
        uint256 fineAmount
    );

    event PortClearanceReleased(
        uint256 indexed incidentId,
        uint256 indexed suspectMMSI
    );

    event FineParametersUpdated(uint256 newBaseFine, uint256 newAreaMultiplier);

    // ==========================================
    // CONSTRUCTOR
    // ==========================================
    /**
     * @notice Contract constructor. Initializes role assignments and fine calculation defaults.
     * @param _baseFine Default base fine amount (demonstration).
     * @param _areaMultiplier Default multiplier per sq km (demonstration).
     */
    constructor(uint256 _baseFine, uint256 _areaMultiplier) {
        // Grant deployer initial roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EVIDENCE_ATTESTOR_ROLE, msg.sender);
        _grantRole(ENFORCEMENT_AUTHORITY_ROLE, msg.sender);

        baseFine = _baseFine;
        areaMultiplier = _areaMultiplier;
    }

    // ==========================================
    // FINE CALCULATION FUNCTION
    // ==========================================
    /**
     * @notice Calculates dynamic demonstration fine using formula: fine = baseFine + (spillAreaSqKm * areaMultiplier).
     * @param spillAreaSqKm Area of oil spill in square kilometers.
     * @return fine Calculated fine amount in USD.
     */
    function calculateFine(uint256 spillAreaSqKm) public view returns (uint256 fine) {
        return baseFine + (spillAreaSqKm * areaMultiplier);
    }

    // ==========================================
    // CORE FUNCTIONS
    // ==========================================

    /**
     * @notice Create and anchor a new oil spill incident on-chain.
     * @dev Restricted to accounts holding EVIDENCE_ATTESTOR_ROLE.
     * @param suspectMMSI 9-digit MMSI number of suspect vessel.
     * @param ipfsCID IPFS Content Identifier for off-chain evidence files.
     * @param evidenceHash SHA-256 hash of raw evidence payload.
     * @param spillAreaSqKm Size of spill in square kilometers.
     * @param attributionScore AI confidence score (0 to 100).
     * @return newIncidentId The ID generated for this incident.
     */
    function createIncident(
        uint256 suspectMMSI,
        string memory ipfsCID,
        bytes32 evidenceHash,
        uint256 spillAreaSqKm,
        uint256 attributionScore
    ) external onlyRole(EVIDENCE_ATTESTOR_ROLE) returns (uint256 newIncidentId) {
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(attributionScore <= 100, "Attribution score must be <= 100");

        incidentCount++;
        newIncidentId = incidentCount;

        uint256 calculatedFineAmount = calculateFine(spillAreaSqKm);

        incidents[newIncidentId] = Incident({
            incidentId: newIncidentId,
            suspectMMSI: suspectMMSI,
            ipfsCID: ipfsCID,
            evidenceHash: evidenceHash,
            spillAreaSqKm: spillAreaSqKm,
            attributionScore: attributionScore,
            fineAmount: calculatedFineAmount,
            status: Status.Anchored,
            createdAt: block.timestamp
        });

        emit IncidentAnchored(
            newIncidentId,
            suspectMMSI,
            ipfsCID,
            evidenceHash,
            spillAreaSqKm,
            attributionScore,
            calculatedFineAmount
        );
    }

    /**
     * @notice Get full incident details by incident ID.
     * @param incidentId ID of the incident.
     */
    function getIncident(uint256 incidentId) external view returns (Incident memory) {
        require(incidentId > 0 && incidentId <= incidentCount, "Incident does not exist");
        return incidents[incidentId];
    }

    /**
     * @notice Enforce fine and automatically emit PortClearanceRevoked event.
     * @dev Restricted to accounts holding ENFORCEMENT_AUTHORITY_ROLE.
     * @param incidentId ID of incident to enforce.
     */
    function enforceFine(uint256 incidentId) external onlyRole(ENFORCEMENT_AUTHORITY_ROLE) {
        require(incidentId > 0 && incidentId <= incidentCount, "Incident does not exist");
        Incident storage incident = incidents[incidentId];
        require(incident.status == Status.Anchored, "Incident status must be Anchored");

        incident.status = Status.Enforced;

        emit FineEnforced(incidentId, incident.suspectMMSI, incident.fineAmount);
        emit PortClearanceRevoked(incidentId, incident.suspectMMSI);
    }

    /**
     * @notice Record settlement of an enforced fine.
     * @dev Restricted to accounts holding ENFORCEMENT_AUTHORITY_ROLE.
     * @param incidentId ID of incident to settle fine for.
     */
    function recordFineSettlement(uint256 incidentId) external onlyRole(ENFORCEMENT_AUTHORITY_ROLE) {
        require(incidentId > 0 && incidentId <= incidentCount, "Incident does not exist");
        Incident storage incident = incidents[incidentId];
        require(incident.status == Status.Enforced, "Incident status must be Enforced");

        incident.status = Status.Settled;

        emit FineSettled(incidentId, incident.suspectMMSI, incident.fineAmount);
    }

    /**
     * @notice Release port clearance after fine settlement.
     * @dev Restricted to accounts holding ENFORCEMENT_AUTHORITY_ROLE.
     * @param incidentId ID of incident to restore port clearance for.
     */
    function releasePortClearance(uint256 incidentId) external onlyRole(ENFORCEMENT_AUTHORITY_ROLE) {
        require(incidentId > 0 && incidentId <= incidentCount, "Incident does not exist");
        Incident storage incident = incidents[incidentId];
        require(incident.status == Status.Settled, "Incident status must be Settled");

        incident.status = Status.Released;

        emit PortClearanceReleased(incidentId, incident.suspectMMSI);
    }

    /**
     * @notice Administrative function to configure fine calculation base rate and area multiplier.
     * @dev Restricted to accounts holding DEFAULT_ADMIN_ROLE.
     * @param _baseFine New base fine amount.
     * @param _areaMultiplier New area multiplier amount.
     */
    function setFineParameters(uint256 _baseFine, uint256 _areaMultiplier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseFine = _baseFine;
        areaMultiplier = _areaMultiplier;
        emit FineParametersUpdated(_baseFine, _areaMultiplier);
    }
}
