const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MaritimeFineLedger Step-by-Step Test Suite", function () {
  let MaritimeFineLedger;
  let ledger;
  let admin, attestor, enforcement, normalUser;

  const BASE_FINE = 10000;
  const AREA_MULTIPLIER = 5000;

  const SAMPLE_MMSI = 367123456;
  const SAMPLE_IPFS_CID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("evidence-data-payload"));
  const SAMPLE_SPILL_AREA = 4; // 4 sq km -> Fine = 10000 + (4 * 5000) = 30000
  const SAMPLE_ATTRIBUTION = 95; // 95%

  beforeEach(async function () {
    [admin, attestor, enforcement, normalUser] = await ethers.getSigners();

    MaritimeFineLedger = await ethers.getContractFactory("MaritimeFineLedger");
    ledger = await MaritimeFineLedger.deploy(BASE_FINE, AREA_MULTIPLIER);
    await ledger.waitForDeployment();
  });

  it("1. Admin can assign roles", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    const ENFORCEMENT_ROLE = await ledger.ENFORCEMENT_AUTHORITY_ROLE();

    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);
    await ledger.connect(admin).grantRole(ENFORCEMENT_ROLE, enforcement.address);

    expect(await ledger.hasRole(ATTESTOR_ROLE, attestor.address)).to.be.true;
    expect(await ledger.hasRole(ENFORCEMENT_ROLE, enforcement.address)).to.be.true;
  });

  it("2. Evidence Attestor can create an incident", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);

    await expect(
      ledger.connect(attestor).createIncident(
        SAMPLE_MMSI,
        SAMPLE_IPFS_CID,
        SAMPLE_HASH,
        SAMPLE_SPILL_AREA,
        SAMPLE_ATTRIBUTION
      )
    ).to.emit(ledger, "IncidentAnchored");

    expect(await ledger.incidentCount()).to.equal(1);
  });

  it("3. Normal users cannot create an incident", async function () {
    await expect(
      ledger.connect(normalUser).createIncident(
        SAMPLE_MMSI,
        SAMPLE_IPFS_CID,
        SAMPLE_HASH,
        SAMPLE_SPILL_AREA,
        SAMPLE_ATTRIBUTION
      )
    ).to.be.revertedWithCustomError(ledger, "AccessControlUnauthorizedAccount");
  });

  it("4. Querying non-existent incident is rejected", async function () {
    await expect(ledger.getIncident(999)).to.be.revertedWith("Incident does not exist");
  });

  it("5. Incident information is stored correctly", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);

    await ledger.connect(attestor).createIncident(
      SAMPLE_MMSI,
      SAMPLE_IPFS_CID,
      SAMPLE_HASH,
      SAMPLE_SPILL_AREA,
      SAMPLE_ATTRIBUTION
    );

    const incident = await ledger.getIncident(1);
    expect(incident.incidentId).to.equal(1);
    expect(incident.suspectMMSI).to.equal(SAMPLE_MMSI);
    expect(incident.ipfsCID).to.equal(SAMPLE_IPFS_CID);
    expect(incident.evidenceHash).to.equal(SAMPLE_HASH);
    expect(incident.spillAreaSqKm).to.equal(SAMPLE_SPILL_AREA);
    expect(incident.attributionScore).to.equal(SAMPLE_ATTRIBUTION);
    expect(incident.fineAmount).to.equal(30000); // 10000 + (4 * 5000)
    expect(incident.status).to.equal(0); // Status.Anchored
  });

  it("6. Fine calculation works correctly", async function () {
    const calculatedFine = await ledger.calculateFine(10);
    const expectedFine = BASE_FINE + 10 * AREA_MULTIPLIER; // 10000 + 50000 = 60000
    expect(calculatedFine).to.equal(expectedFine);
  });

  it("7. Enforcement Authority can enforce a fine", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    const ENFORCEMENT_ROLE = await ledger.ENFORCEMENT_AUTHORITY_ROLE();
    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);
    await ledger.connect(admin).grantRole(ENFORCEMENT_ROLE, enforcement.address);

    await ledger.connect(attestor).createIncident(
      SAMPLE_MMSI,
      SAMPLE_IPFS_CID,
      SAMPLE_HASH,
      SAMPLE_SPILL_AREA,
      SAMPLE_ATTRIBUTION
    );

    await ledger.connect(enforcement).enforceFine(1);
    const incident = await ledger.getIncident(1);
    expect(incident.status).to.equal(1); // Status.Enforced
  });

  it("8. Unauthorized users cannot enforce a fine", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);

    await ledger.connect(attestor).createIncident(
      SAMPLE_MMSI,
      SAMPLE_IPFS_CID,
      SAMPLE_HASH,
      SAMPLE_SPILL_AREA,
      SAMPLE_ATTRIBUTION
    );

    await expect(
      ledger.connect(normalUser).enforceFine(1)
    ).to.be.revertedWithCustomError(ledger, "AccessControlUnauthorizedAccount");
  });

  it("9. PortClearanceRevoked event is emitted upon enforcement", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    const ENFORCEMENT_ROLE = await ledger.ENFORCEMENT_AUTHORITY_ROLE();
    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);
    await ledger.connect(admin).grantRole(ENFORCEMENT_ROLE, enforcement.address);

    await ledger.connect(attestor).createIncident(
      SAMPLE_MMSI,
      SAMPLE_IPFS_CID,
      SAMPLE_HASH,
      SAMPLE_SPILL_AREA,
      SAMPLE_ATTRIBUTION
    );

    const tx = await ledger.connect(enforcement).enforceFine(1);
    await expect(tx).to.emit(ledger, "PortClearanceRevoked").withArgs(1, SAMPLE_MMSI);
  });

  it("10. Settlement works", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    const ENFORCEMENT_ROLE = await ledger.ENFORCEMENT_AUTHORITY_ROLE();
    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);
    await ledger.connect(admin).grantRole(ENFORCEMENT_ROLE, enforcement.address);

    await ledger.connect(attestor).createIncident(
      SAMPLE_MMSI,
      SAMPLE_IPFS_CID,
      SAMPLE_HASH,
      SAMPLE_SPILL_AREA,
      SAMPLE_ATTRIBUTION
    );

    await ledger.connect(enforcement).enforceFine(1);

    const tx = await ledger.connect(enforcement).recordFineSettlement(1);
    await expect(tx).to.emit(ledger, "FineSettled").withArgs(1, SAMPLE_MMSI, 30000);

    const incident = await ledger.getIncident(1);
    expect(incident.status).to.equal(2); // Status.Settled
  });

  it("11. Port clearance can be released after settlement", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    const ENFORCEMENT_ROLE = await ledger.ENFORCEMENT_AUTHORITY_ROLE();
    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);
    await ledger.connect(admin).grantRole(ENFORCEMENT_ROLE, enforcement.address);

    await ledger.connect(attestor).createIncident(
      SAMPLE_MMSI,
      SAMPLE_IPFS_CID,
      SAMPLE_HASH,
      SAMPLE_SPILL_AREA,
      SAMPLE_ATTRIBUTION
    );

    await ledger.connect(enforcement).enforceFine(1);
    await ledger.connect(enforcement).recordFineSettlement(1);

    const tx = await ledger.connect(enforcement).releasePortClearance(1);
    await expect(tx).to.emit(ledger, "PortClearanceReleased").withArgs(1, SAMPLE_MMSI);

    const incident = await ledger.getIncident(1);
    expect(incident.status).to.equal(3); // Status.Released
  });

  it("12. Invalid state transitions are rejected", async function () {
    const ATTESTOR_ROLE = await ledger.EVIDENCE_ATTESTOR_ROLE();
    const ENFORCEMENT_ROLE = await ledger.ENFORCEMENT_AUTHORITY_ROLE();
    await ledger.connect(admin).grantRole(ATTESTOR_ROLE, attestor.address);
    await ledger.connect(admin).grantRole(ENFORCEMENT_ROLE, enforcement.address);

    await ledger.connect(attestor).createIncident(
      SAMPLE_MMSI,
      SAMPLE_IPFS_CID,
      SAMPLE_HASH,
      SAMPLE_SPILL_AREA,
      SAMPLE_ATTRIBUTION
    );

    // Reject settlement before enforcing
    await expect(
      ledger.connect(enforcement).recordFineSettlement(1)
    ).to.be.revertedWith("Incident status must be Enforced");

    // Reject release before settling
    await expect(
      ledger.connect(enforcement).releasePortClearance(1)
    ).to.be.revertedWith("Incident status must be Settled");

    // Enforce fine
    await ledger.connect(enforcement).enforceFine(1);

    // Reject re-enforcing an already enforced fine
    await expect(
      ledger.connect(enforcement).enforceFine(1)
    ).to.be.revertedWith("Incident status must be Anchored");
  });
});
