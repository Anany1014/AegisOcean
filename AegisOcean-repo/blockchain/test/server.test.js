const { expect } = require("chai");
const axios = require("axios");
const app = require("../server");

describe("Blockchain Express Server Endpoint Tests", function () {
  let server;
  const baseUrl = "http://localhost:4001";

  before(function (done) {
    server = app.listen(4001, () => done());
  });

  after(function (done) {
    server.close(() => done());
  });

  it("1. GET /api/blockchain/incident/:id returns all required 10 fields", async function () {
    const response = await axios.get(`${baseUrl}/api/blockchain/incident/1`);
    const data = response.data;

    expect(data.success).to.be.true;
    expect(data).to.have.property("blockchainStatus");
    expect(data).to.have.property("incidentId");
    expect(data).to.have.property("suspectMMSI");
    expect(data).to.have.property("attributionScore");
    expect(data).to.have.property("spillAreaSqKm");
    expect(data).to.have.property("ipfsCID");
    expect(data).to.have.property("evidenceHash");
    expect(data).to.have.property("fineAmountUSD");
    expect(data).to.have.property("enforcementStatus");
    expect(data).to.have.property("transactionHash");
  });

  it("2. POST /api/blockchain/verify-evidence compares hashes and returns Evidence Verified", async function () {
    const payload = {
      storedEvidenceHash: "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      ipfsCID: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
    };

    const response = await axios.post(`${baseUrl}/api/blockchain/verify-evidence`, payload);
    const data = response.data;

    expect(data.success).to.be.true;
    expect(data.verified).to.be.true;
    expect(data.statusMessage).to.equal("Evidence Verified");
  });

  it("3. POST /api/blockchain/enforce updates state and returns Confirmed transaction", async function () {
    const response = await axios.post(`${baseUrl}/api/blockchain/enforce`, { incidentId: 1 });
    const data = response.data;

    expect(data.success).to.be.true;
    expect(data.status).to.equal("Confirmed");
    expect(data.enforcementStatus).to.equal("Enforced");
    expect(data.clearanceRevoked).to.be.true;
  });
});
