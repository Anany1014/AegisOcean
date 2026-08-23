const { expect } = require("chai");
const { ethers } = require("hardhat");
const IPFSService = require("../services/ipfsService");
const IncidentService = require("../services/incidentService");
const AIPipelineAdapter = require("../services/aiPipelineAdapter");

describe("AIPipelineAdapter Unit Tests", function () {
  let ledger;
  let admin, attestor;
  let adapter;

  const BASE_FINE = 10000;
  const AREA_MULTIPLIER = 5000;

  const mockPythonAIDetectionResult = {
    vessel_mmsi: 367111222,
    area_sq_km: 8.5,
    attribution_score: 94,
    satellite_image: "s3://aegisocean-buckets/sat_2026_08_23.tif",
    geojson: { type: "FeatureCollection", features: [] },
    hydrodynamic_result: { windVector: [10, 45], currentVector: [0.5, 120] },
    ais_result: { candidateVesselsCount: 4, topSuspectMMSI: 367111222 },
    pas_report: { attributionConfidence: 94 }
  };

  beforeEach(async function () {
    [admin, attestor] = await ethers.getSigners();

    const MaritimeFineLedger = await ethers.getContractFactory("MaritimeFineLedger");
    ledger = await MaritimeFineLedger.deploy(BASE_FINE, AREA_MULTIPLIER);
    await ledger.waitForDeployment();

    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    await ledger.grantRole(ATTESTOR_ROLE, attestor.address);

    const contractAddress = await ledger.getAddress();
    const ipfsService = new IPFSService();
    const incidentService = new IncidentService(contractAddress, ledger.connect(attestor), ipfsService);

    adapter = new AIPipelineAdapter(incidentService);
  });

  it("1. Should normalize Python AI model outputs and anchor on-chain", async function () {
    const result = await adapter.onDetectionCompleted(mockPythonAIDetectionResult);

    expect(result.success).to.be.true;
    expect(result.incidentId).to.equal(1);
    expect(result.suspectMMSI).to.equal(367111222);
    expect(result.spillAreaSqKm).to.equal(9); // Math.round(8.5) -> 9 uint256
    expect(result.attributionScore).to.equal(94);
    expect(result.ipfsCID).to.match(/^Qm/);
    expect(result.evidenceHash).to.match(/^0x[a-fA-F0-9]{64}$/);

    const incident = await ledger.getIncident(1);
    expect(incident.suspectMMSI).to.equal(367111222);
    expect(incident.ipfsCID).to.equal(result.ipfsCID);
  });
});
