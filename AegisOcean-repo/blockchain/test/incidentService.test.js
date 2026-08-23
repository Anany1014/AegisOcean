const { expect } = require("chai");
const { ethers } = require("hardhat");
const IPFSService = require("../services/ipfsService");
const IncidentService = require("../services/incidentService");

describe("IncidentService End-to-End Pipeline Tests", function () {
  let ledger;
  let admin, attestor, unauthorizedUser;
  let incidentService;

  const BASE_FINE = 10000;
  const AREA_MULTIPLIER = 5000;

  const sampleForensicData = {
    suspectMMSI: 367987654,
    spillAreaSqKm: 5,
    attributionScore: 92,
    satelliteImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    spillGeoJSON: { type: "Polygon", coordinates: [] },
    driftData: { windKnots: 12 },
    aisData: { targetMMSI: 367987654 },
    pasReport: { confidence: 92 }
  };

  beforeEach(async function () {
    [admin, attestor, unauthorizedUser] = await ethers.getSigners();

    const MaritimeFineLedger = await ethers.getContractFactory("MaritimeFineLedger");
    ledger = await MaritimeFineLedger.deploy(BASE_FINE, AREA_MULTIPLIER);
    await ledger.waitForDeployment();

    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    await ledger.grantRole(ATTESTOR_ROLE, attestor.address);

    const contractAddress = await ledger.getAddress();
    const ipfsService = new IPFSService();

    incidentService = new IncidentService(contractAddress, ledger.connect(attestor), ipfsService);
  });

  it("1. Should execute full pipeline: Forensic Data -> IPFS -> Blockchain", async function () {
    const result = await incidentService.processAndAnchorIncident(sampleForensicData);

    expect(result.success).to.be.true;
    expect(result.incidentId).to.equal(1);
    expect(result.suspectMMSI).to.equal(sampleForensicData.suspectMMSI);
    expect(result.spillAreaSqKm).to.equal(sampleForensicData.spillAreaSqKm);
    expect(result.attributionScore).to.equal(sampleForensicData.attributionScore);
    expect(result.fineAmountUSD).to.equal(35000); // 10000 + (5 * 5000)
    expect(result.ipfsCID).to.match(/^Qm/);
    expect(result.evidenceHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    // Verify directly on the smart contract state
    const onChainIncident = await ledger.getIncident(1);
    expect(onChainIncident.suspectMMSI).to.equal(sampleForensicData.suspectMMSI);
    expect(onChainIncident.ipfsCID).to.equal(result.ipfsCID);
    expect(onChainIncident.evidenceHash).to.equal(result.evidenceHash);
  });

  it("2. Should reject invalid input data (invalid MMSI, area, or attribution score)", async function () {
    const invalidMMSI = { ...sampleForensicData, suspectMMSI: -5 };
    const invalidArea = { ...sampleForensicData, spillAreaSqKm: -1 };
    const invalidScore = { ...sampleForensicData, attributionScore: 150 };

    await expect(incidentService.processAndAnchorIncident(invalidMMSI)).to.be.rejectedWith("Invalid data");
    await expect(incidentService.processAndAnchorIncident(invalidArea)).to.be.rejectedWith("Invalid data");
    await expect(incidentService.processAndAnchorIncident(invalidScore)).to.be.rejectedWith("Invalid data");
  });

  it("3. Should reject transaction if server wallet lacks EVIDENCE_ATTESTOR_ROLE", async function () {
    const contractAddress = await ledger.getAddress();
    const unauthorizedService = new IncidentService(
      contractAddress,
      ledger.connect(unauthorizedUser),
      new IPFSService()
    );

    await expect(
      unauthorizedService.processAndAnchorIncident(sampleForensicData)
    ).to.be.rejectedWith("EVIDENCE_ATTESTOR_ROLE");
  });

  it("4. Should handle IPFS upload errors gracefully", async function () {
    const failingIpfsService = {
      createEvidenceBundle: () => ({ suspectMMSI: 123 }),
      uploadEvidenceBundle: async () => {
        throw new Error("Pinata service unreachable");
      }
    };

    const contractAddress = await ledger.getAddress();
    const failingService = new IncidentService(
      contractAddress,
      ledger.connect(attestor),
      failingIpfsService
    );

    await expect(
      failingService.processAndAnchorIncident(sampleForensicData)
    ).to.be.rejectedWith("IPFS upload failure: Pinata service unreachable");
  });
});
